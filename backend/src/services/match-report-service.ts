import type { PrismaClient, Prisma, Match, User } from '@prisma/client';
import { calculateMatchRatingChange } from './elo-core';
import { decideReportOutcome, canApprove } from './match-report-core';

export const AUTO_APPROVE_TIMEOUT_MS = 5 * 60 * 1000;
export const DRAW_TIMEOUT_MS = 40 * 60 * 1000;

type Tx = Prisma.TransactionClient;

export type ReportOutcomeKind = 'WAITING' | 'COMPLETED' | 'DISPUTED';

export interface ReportResult {
  outcome: ReportOutcomeKind;
  match: Match;
  /** outcome=COMPLETED のときに含まれる */
  finalize?: FinalizeResult;
  /** outcome=DISPUTED のときの dispute id */
  disputeId?: string;
}

export interface FinalizeResult {
  winner: User;
  loser: User;
  winnerDelta: number;
  loserDelta: number;
}

/**
 * 勝敗を報告する
 * - IN_PROGRESS なら最初の報告として WAITING_APPROVAL に進める
 * - WAITING_APPROVAL なら相手の報告と照合して COMPLETED か DISPUTED に
 */
export async function reportWin(
  prisma: PrismaClient,
  matchId: string,
  reporterId: string,
  declaredWinnerId: string,
): Promise<ReportResult> {
  return prisma.$transaction((tx) =>
    reportWinTx(tx, matchId, reporterId, declaredWinnerId),
  );
}

async function reportWinTx(
  tx: Tx,
  matchId: string,
  reporterId: string,
  declaredWinnerId: string,
): Promise<ReportResult> {
  const match = await tx.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error('Match not found');
  if (match.status !== 'IN_PROGRESS' && match.status !== 'WAITING_APPROVAL') {
    throw new Error(`このステータスでは報告できません: ${match.status}`);
  }
  if (reporterId !== match.player1Id && reporterId !== match.player2Id) {
    throw new Error('参加者ではありません');
  }
  if (declaredWinnerId !== match.player1Id && declaredWinnerId !== match.player2Id) {
    throw new Error('不正な勝者ID');
  }

  // 自分が既に報告していれば拒否
  const existingReports = await tx.matchReport.findMany({ where: { matchId } });
  const myExisting = existingReports.find((r) => r.reporterId === reporterId);
  if (myExisting) {
    throw new Error('既に報告済みです');
  }

  // 報告を記録
  await tx.matchReport.create({
    data: { matchId, reporterId, reportedWinnerId: declaredWinnerId },
  });

  const outcome = decideReportOutcome(
    existingReports.map((r) => ({
      reporterId: r.reporterId,
      reportedWinnerId: r.reportedWinnerId,
    })),
    { reporterId, reportedWinnerId: declaredWinnerId },
  );

  if (outcome.kind === 'WAITING') {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        status: 'WAITING_APPROVAL',
        winnerId: declaredWinnerId,
        reportedAt: new Date(),
      },
    });
    return { outcome: 'WAITING', match: updated };
  }

  if (outcome.kind === 'COMPLETED') {
    const finalized = await finalizeMatchTx(tx, matchId, outcome.winnerId);
    return { outcome: 'COMPLETED', match: finalized.match, finalize: finalized.result };
  }

  // DISPUTED
  const updated = await tx.match.update({
    where: { id: matchId },
    data: { status: 'DISPUTED', winnerId: null },
  });
  const dispute = await tx.dispute.create({
    data: {
      matchId,
      raisedById: reporterId,
      description: '両者の報告内容が食い違っています（自動）',
      evidenceUrls: [],
      status: 'OPEN',
    },
  });
  return { outcome: 'DISPUTED', match: updated, disputeId: dispute.id };
}

/**
 * 承認 = 「相手の報告と同じ勝者で報告する」と等価
 * 自分が既に報告していたら使えない
 */
export async function approveReport(
  prisma: PrismaClient,
  matchId: string,
  approverId: string,
): Promise<ReportResult> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'WAITING_APPROVAL') {
      throw new Error(`このステータスでは承認できません: ${match.status}`);
    }
    const reports = await tx.matchReport.findMany({ where: { matchId } });
    const reportTuples = reports.map((r) => ({
      reporterId: r.reporterId,
      reportedWinnerId: r.reportedWinnerId,
    }));
    if (!canApprove(reportTuples, approverId)) {
      throw new Error('自分の報告は承認できません');
    }
    const otherReport = reports.find((r) => r.reporterId !== approverId);
    if (!otherReport) throw new Error('承認する対象の報告がありません');

    return reportWinTx(tx, matchId, approverId, otherReport.reportedWinnerId);
  });
}

/**
 * 異議申し立て：相手の報告を拒否して紛争状態に
 */
export async function rejectReport(
  prisma: PrismaClient,
  matchId: string,
  rejecterId: string,
  description: string,
  evidenceUrls: string[] = [],
): Promise<{ match: Match; disputeId: string }> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'WAITING_APPROVAL') {
      throw new Error(`このステータスでは異議申し立てできません: ${match.status}`);
    }
    if (rejecterId !== match.player1Id && rejecterId !== match.player2Id) {
      throw new Error('参加者ではありません');
    }
    const reports = await tx.matchReport.findMany({ where: { matchId } });
    if (reports.length === 0) throw new Error('まだ報告がありません');
    const myReport = reports.find((r) => r.reporterId === rejecterId);
    if (myReport) throw new Error('自分の報告には異議申し立てできません');

    const updated = await tx.match.update({
      where: { id: matchId },
      data: { status: 'DISPUTED', winnerId: null },
    });
    const dispute = await tx.dispute.create({
      data: {
        matchId,
        raisedById: rejecterId,
        description: description || '報告内容に異議があります',
        evidenceUrls,
        status: 'OPEN',
      },
    });
    return { match: updated, disputeId: dispute.id };
  });
}

/**
 * 5分自動承認：WAITING_APPROVAL のまま放置された試合を確定する
 */
export async function autoApprove(
  prisma: PrismaClient,
  matchId: string,
): Promise<ReportResult> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'WAITING_APPROVAL') {
      throw new Error(`このステータスでは自動承認できません: ${match.status}`);
    }
    if (!match.winnerId) throw new Error('Winner not set');
    const finalized = await finalizeMatchTx(tx, matchId, match.winnerId);
    return {
      outcome: 'COMPLETED' as const,
      match: finalized.match,
      finalize: finalized.result,
    };
  });
}

/**
 * 40分タイムアウト：両者報告なし → 両者敗北（レート変動なし・敗北数のみ加算）
 * イベント戦は成績を一切変えず、試合を打ち切るだけ。
 */
export async function markAsTimeoutLoss(
  prisma: PrismaClient,
  matchId: string,
): Promise<Match> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot mark as timeout in status ${match.status}`);
    }

    if (match.mode !== 'EVENT') {
      await tx.user.updateMany({
        where: { id: { in: [match.player1Id, match.player2Id] } },
        data: { losses: { increment: 1 }, matchCount: { increment: 1 } },
      });
    }

    return tx.match.update({
      where: { id: matchId },
      data: { status: 'INTERRUPTED', endedAt: new Date() },
    });
  });
}

/**
 * （旧）40分タイムアウト：引き分け。現在は markAsTimeoutLoss を使用。
 */
export async function markAsDraw(
  prisma: PrismaClient,
  matchId: string,
): Promise<Match> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot mark as draw in status ${match.status}`);
    }

    return tx.match.update({
      where: { id: matchId },
      data: {
        status: 'DRAW',
        endedAt: new Date(),
      },
    });
  });
}

/**
 * トランザクション内で matchを COMPLETED にして Elo を適用する内部関数
 */
async function finalizeMatchTx(
  tx: Tx,
  matchId: string,
  winnerId: string,
): Promise<{ match: Match; result: FinalizeResult }> {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
  const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;

  const winner = await tx.user.findUniqueOrThrow({ where: { id: winnerId } });
  const loser = await tx.user.findUniqueOrThrow({ where: { id: loserId } });

  // イベント戦はレート・勝敗数を一切変動させず、試合結果だけを確定する
  if (match.mode === 'EVENT') {
    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: { status: 'COMPLETED', winnerId: winner.id, endedAt: new Date() },
    });
    return {
      match: updatedMatch,
      result: { winner, loser, winnerDelta: 0, loserDelta: 0 },
    };
  }

  const change = calculateMatchRatingChange({
    winnerRating: winner.currentRating,
    loserRating: loser.currentRating,
    winnerMatchCount: winner.matchCount,
    loserMatchCount: loser.matchCount,
  });

  const updatedWinner = await tx.user.update({
    where: { id: winner.id },
    data: {
      currentRating: change.winner.after,
      highestRating: Math.max(winner.highestRating, change.winner.after),
      wins: winner.wins + 1,
      matchCount: winner.matchCount + 1,
      consecutiveTossCount: 0,
    },
  });

  const updatedLoser = await tx.user.update({
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
        matchId,
        ratingBefore: change.winner.before,
        ratingAfter: change.winner.after,
        delta: change.winner.delta,
        reason: 'MATCH',
      },
      {
        userId: loser.id,
        matchId,
        ratingBefore: change.loser.before,
        ratingAfter: change.loser.after,
        delta: change.loser.delta,
        reason: 'MATCH',
      },
    ],
  });

  const updatedMatch = await tx.match.update({
    where: { id: matchId },
    data: {
      status: 'COMPLETED',
      winnerId: winner.id,
      endedAt: new Date(),
    },
  });

  return {
    match: updatedMatch,
    result: {
      winner: updatedWinner,
      loser: updatedLoser,
      winnerDelta: change.winner.delta,
      loserDelta: change.loser.delta,
    },
  };
}

export interface MatchTickResult {
  autoApproved: ReportResult[];
  drawn: Match[];
}

export async function tickMatchTimeouts(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<MatchTickResult> {
  const autoApproved: ReportResult[] = [];
  const drawn: Match[] = [];

  const waiting = await prisma.match.findMany({
    where: { status: 'WAITING_APPROVAL' },
  });
  for (const m of waiting) {
    if (!m.reportedAt) continue;
    if (now.getTime() - m.reportedAt.getTime() > AUTO_APPROVE_TIMEOUT_MS) {
      try {
        const result = await autoApprove(prisma, m.id);
        autoApproved.push(result);
      } catch (e) {
        console.error('[tickMatchTimeouts] autoApprove failed', m.id, e);
      }
    }
  }

  const inProgress = await prisma.match.findMany({
    where: { status: 'IN_PROGRESS' },
  });
  for (const m of inProgress) {
    if (!m.acceptedAt) continue;
    if (now.getTime() - m.acceptedAt.getTime() > DRAW_TIMEOUT_MS) {
      try {
        // 時間切れは両者敗北として記録する
        const updated = await markAsTimeoutLoss(prisma, m.id);
        drawn.push(updated);
      } catch (e) {
        console.error('[tickMatchTimeouts] markAsTimeoutLoss failed', m.id, e);
      }
    }
  }

  return { autoApproved, drawn };
}
