import type { PrismaClient, User, Match, Dispute } from '@prisma/client';
import { calculateMatchRatingChange } from './elo-core';

export interface AdminDashboardStats {
  totalUsers: number;
  bannedUsers: number;
  activeUsers: number;
  matchesInProgress: number;
  matchesPendingToss: number;
  matchesWaitingApproval: number;
  matchesDisputed: number;
  queueSize: number;
  matchesToday: number;
}

/**
 * ダッシュボード統計
 */
export async function getDashboardStats(
  prisma: PrismaClient,
): Promise<AdminDashboardStats> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers,
    bannedUsers,
    activeUsers,
    matchesInProgress,
    matchesPendingToss,
    matchesWaitingApproval,
    matchesDisputed,
    queueSize,
    matchesToday,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { matchCount: { gt: 0 }, isBanned: false } }),
    prisma.match.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.match.count({ where: { status: 'PENDING_TOSS' } }),
    prisma.match.count({ where: { status: 'WAITING_APPROVAL' } }),
    prisma.match.count({ where: { status: 'DISPUTED' } }),
    prisma.queueEntry.count(),
    prisma.match.count({ where: { startedAt: { gte: today } } }),
  ]);

  return {
    totalUsers,
    bannedUsers,
    activeUsers,
    matchesInProgress,
    matchesPendingToss,
    matchesWaitingApproval,
    matchesDisputed,
    queueSize,
    matchesToday,
  };
}

/**
 * ユーザー検索（ユーザー名または Discord ID）
 */
export async function searchUsers(
  prisma: PrismaClient,
  query: string,
  limit = 30,
): Promise<User[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  return prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: trimmed, mode: 'insensitive' } },
        { discordId: { contains: trimmed } },
      ],
    },
    orderBy: { username: 'asc' },
    take: limit,
  });
}

/**
 * ユーザーをBANする
 */
export async function banUser(
  prisma: PrismaClient,
  userId: string,
  reason: string,
  bannedBy: string,
): Promise<User> {
  return prisma.$transaction(async (tx) => {
    await tx.ban.create({
      data: { userId, reason, bannedBy },
    });
    // BAN中はキューから抜く
    await tx.queueEntry.deleteMany({ where: { userId } });
    return tx.user.update({
      where: { id: userId },
      data: { isBanned: true },
    });
  });
}

/**
 * BAN解除
 */
export async function unbanUser(prisma: PrismaClient, userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { isBanned: false },
  });
}

/**
 * レート手動調整
 */
export async function adjustRating(
  prisma: PrismaClient,
  userId: string,
  newRating: number,
  reason: string,
): Promise<User> {
  if (!Number.isInteger(newRating) || newRating < 0) {
    throw new Error('レートは0以上の整数で指定してください');
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const delta = newRating - user.currentRating;
    await tx.ratingHistory.create({
      data: {
        userId,
        ratingBefore: user.currentRating,
        ratingAfter: newRating,
        delta,
        reason: 'ADMIN_ADJUST',
      },
    });
    void reason; // 補足が必要なら別カラムを追加
    return tx.user.update({
      where: { id: userId },
      data: {
        currentRating: newRating,
        highestRating: Math.max(user.highestRating, newRating),
      },
    });
  });
}

export interface DisputeWithDetail {
  dispute: Dispute;
  match: Match;
  player1: User;
  player2: User;
  reports: Array<{ reporterId: string; reportedWinnerId: string }>;
}

/**
 * オープン中の紛争一覧を取得
 */
export async function listOpenDisputes(
  prisma: PrismaClient,
): Promise<DisputeWithDetail[]> {
  const disputes = await prisma.dispute.findMany({
    where: { status: 'OPEN' },
    include: {
      match: {
        include: {
          player1: true,
          player2: true,
          reports: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return disputes.map((d) => ({
    dispute: d,
    match: d.match,
    player1: d.match.player1,
    player2: d.match.player2,
    reports: d.match.reports.map((r) => ({
      reporterId: r.reporterId,
      reportedWinnerId: r.reportedWinnerId,
    })),
  }));
}

/**
 * 紛争を裁定して試合を確定する
 *
 * - 勝者を決め、Eloを適用
 * - キャンセルなら無効化（レート変動なし）
 */
export async function resolveDispute(
  prisma: PrismaClient,
  disputeId: string,
  adminDiscordId: string,
  resolution: { winnerId: string } | { cancel: true },
): Promise<{ match: Match; dispute: Dispute }> {
  return prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    if (dispute.status !== 'OPEN') {
      throw new Error('既に裁定済みです');
    }
    const match = await tx.match.findUniqueOrThrow({ where: { id: dispute.matchId } });
    if (match.status !== 'DISPUTED') {
      throw new Error('紛争状態ではありません');
    }

    let updatedMatch: Match;
    if ('cancel' in resolution) {
      updatedMatch = await tx.match.update({
        where: { id: match.id },
        data: { status: 'CANCELLED', endedAt: new Date() },
      });
    } else {
      const winnerId = resolution.winnerId;
      if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
        throw new Error('不正な勝者');
      }
      const loserId =
        winnerId === match.player1Id ? match.player2Id : match.player1Id;

      const winner = await tx.user.findUniqueOrThrow({ where: { id: winnerId } });
      const loser = await tx.user.findUniqueOrThrow({ where: { id: loserId } });

      const change = calculateMatchRatingChange({
        winnerRating: winner.currentRating,
        loserRating: loser.currentRating,
        winnerMatchCount: winner.matchCount,
        loserMatchCount: loser.matchCount,
      });

      await tx.user.update({
        where: { id: winner.id },
        data: {
          currentRating: change.winner.after,
          highestRating: Math.max(winner.highestRating, change.winner.after),
          wins: winner.wins + 1,
          matchCount: winner.matchCount + 1,
          consecutiveTossCount: 0,
        },
      });
      await tx.user.update({
        where: { id: loser.id },
        data: {
          currentRating: change.loser.after,
          losses: loser.losses + 1,
          matchCount: loser.matchCount + 1,
          consecutiveTossCount: 0,
        },
      });
      await tx.ratingHistory.createMany({
        data: [
          {
            userId: winner.id,
            matchId: match.id,
            ratingBefore: change.winner.before,
            ratingAfter: change.winner.after,
            delta: change.winner.delta,
            reason: 'MATCH',
          },
          {
            userId: loser.id,
            matchId: match.id,
            ratingBefore: change.loser.before,
            ratingAfter: change.loser.after,
            delta: change.loser.delta,
            reason: 'MATCH',
          },
        ],
      });

      updatedMatch = await tx.match.update({
        where: { id: match.id },
        data: {
          status: 'COMPLETED',
          winnerId,
          endedAt: new Date(),
        },
      });
    }

    const updatedDispute = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED',
        resolvedWinnerId: 'cancel' in resolution ? null : resolution.winnerId,
        resolvedByAdminId: adminDiscordId,
        resolvedAt: new Date(),
      },
    });

    return { match: updatedMatch, dispute: updatedDispute };
  });
}
