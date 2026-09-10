import type { PrismaClient, Match, User, QueueSource, MatchMode } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import {
  findMatch,
  findAllMatches,
  isExpired,
  computeRange,
  RECENT_OPPONENTS_BLOCK_COUNT,
  type CandidateInput,
  type MatchableInput,
} from './matchmaking-core';

export interface QueueState {
  inQueue: boolean;
  enteredAt?: Date;
  currentRange?: number;
  ratingAtEntry?: number;
  mode?: MatchMode;
}

export interface EnterResult {
  matched: false;
  enteredAt: Date;
  ratingAtEntry: number;
}

export interface MatchedResult {
  matched: true;
  match: Match;
  opponent: User;
  self: User;
}

/**
 * ユーザーをキューに入れる。マッチ可能な相手がいれば即座にマッチさせる。
 *
 * @returns マッチ成立時は MatchedResult、待機開始時は EnterResult
 */
export interface EnterQueueOptions {
  source?: QueueSource;
  channelId?: string;
  /** NORMAL(既定) or EVENT。イベントはレート差無視・再マッチ制限なし・レート変動なし。 */
  mode?: MatchMode;
}

export async function enterQueue(
  prisma: PrismaClient,
  userId: string,
  socketId?: string,
  opts: EnterQueueOptions = {},
): Promise<EnterResult | MatchedResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.isBanned) throw new Error('User is banned');

  // 進行中の試合があれば拒否。
  // ただし WAITING_APPROVAL は「既に報告済みの側」だけ次のマッチングに並べる
  // （承認/異議をまだ選んでいない側はブロック）。
  const activeMatches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
      status: { in: ['PENDING_TOSS', 'IN_PROGRESS', 'WAITING_APPROVAL', 'DISPUTED'] },
    },
  });
  for (const m of activeMatches) {
    if (m.status === 'WAITING_APPROVAL') {
      const myReport = await prisma.matchReport.findFirst({
        where: { matchId: m.id, reporterId: userId },
      });
      if (!myReport) {
        throw new Error(
          '承認待ちの試合があります。先に「承認」または「異議あり」を選んでください',
        );
      }
    } else {
      throw new Error('進行中の試合があります');
    }
  }

  const mode: MatchMode = opts.mode ?? 'NORMAL';

  // 既にキュー内なら socketId を更新して既存状態を返す（idempotent）
  const existing = await prisma.queueEntry.findUnique({ where: { userId } });
  if (existing) {
    if (existing.mode !== mode) {
      throw new Error(
        existing.mode === 'EVENT'
          ? 'イベントマッチングで待機中です。先に「中断」してください'
          : '通常マッチングで待機中です。先に「中断」してください',
      );
    }
    const updated = await prisma.queueEntry.update({
      where: { userId },
      data: { socketId },
    });
    return {
      matched: false,
      enteredAt: updated.enteredAt,
      ratingAtEntry: updated.ratingAtEntry,
    };
  }

  const now = new Date();
  const myInput: MatchableInput = {
    userId,
    rating: user.currentRating,
    enteredAt: now,
    blockedOpponents: mode === 'EVENT' ? [] : await getRecentOpponents(prisma, userId),
    averageStarRating: user.averageStarRating,
  };

  // 候補を取得（同一モードのみ）
  const candidates = await loadCandidates(prisma, userId, mode);

  // イベントはレート差無視のFIFO（最も長く待っている相手と組む）
  const opponent =
    mode === 'EVENT'
      ? ([...candidates].sort(
          (a, b) => a.enteredAt.getTime() - b.enteredAt.getTime(),
        )[0] ?? null)
      : findMatch(myInput, candidates, now);

  if (!opponent) {
    // 待機列へ。レースで既に作成されているケースはunique制約エラーをハンドル
    try {
      const entry = await prisma.queueEntry.create({
        data: {
          userId,
          ratingAtEntry: user.currentRating,
          socketId,
          source: opts.source ?? 'WEB',
          mode,
          channelId: opts.channelId ?? null,
        },
      });
      return {
        matched: false,
        enteredAt: entry.enteredAt,
        ratingAtEntry: entry.ratingAtEntry,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // 別リクエストが先に作成済み → 既存の値を返す
        const fallback = await prisma.queueEntry.findUniqueOrThrow({ where: { userId } });
        await prisma.queueEntry.update({ where: { userId }, data: { socketId } });
        return {
          matched: false,
          enteredAt: fallback.enteredAt,
          ratingAtEntry: fallback.ratingAtEntry,
        };
      }
      throw e;
    }
  }

  // マッチ成立 → トランザクションで試合作成 & 両者をキューから削除
  return await prisma.$transaction(async (tx) => {
    const opponentUser = await tx.user.findUnique({ where: { id: opponent.userId } });
    if (!opponentUser) throw new Error('Opponent vanished');

    // 両プレイヤーの stale エントリも含めて削除（StrictMode等のレース対策）
    await tx.queueEntry.deleteMany({
      where: { userId: { in: [userId, opponent.userId] } },
    });

    const match = await tx.match.create({
      data: {
        player1Id: userId,
        player2Id: opponent.userId,
        status: 'PENDING_TOSS',
        mode,
      },
    });

    // イベント戦は再マッチ制限の対象にしない
    if (mode === 'NORMAL') {
      await tx.recentOpponent.createMany({
        data: [
          { userId, opponentId: opponent.userId, matchId: match.id },
          { userId: opponent.userId, opponentId: userId, matchId: match.id },
        ],
      });
    }

    return {
      matched: true,
      match,
      opponent: opponentUser,
      self: user,
    };
  });
}

/**
 * キューから抜ける
 */
export async function leaveQueue(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.queueEntry.deleteMany({ where: { userId } });
}

/**
 * 現在のキュー状態を取得
 */
export async function getQueueState(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<QueueState> {
  const entry = await prisma.queueEntry.findUnique({ where: { userId } });
  if (!entry) return { inQueue: false };
  return {
    inQueue: true,
    enteredAt: entry.enteredAt,
    ratingAtEntry: entry.ratingAtEntry,
    currentRange: computeRange(entry.enteredAt, now),
    mode: entry.mode,
  };
}

interface TickResult {
  timedOutUserIds: string[];
  matches: Array<{ match: Match; player1: User; player2: User; player1SocketId: string; player2SocketId: string }>;
}

/**
 * 定期実行：タイムアウト処理 + 再マッチ試行
 */
export async function tick(prisma: PrismaClient, now: Date = new Date()): Promise<TickResult> {
  const all = await prisma.queueEntry.findMany({ include: { user: true } });

  // タイムアウト処理
  const expired = all.filter((e) => isExpired(e.enteredAt, now));
  if (expired.length > 0) {
    await prisma.queueEntry.deleteMany({
      where: { userId: { in: expired.map((e) => e.userId) } },
    });
  }

  const remaining = all.filter((e) => !isExpired(e.enteredAt, now));

  // 通常キュー: レート差ベースのマッチング
  const normalEntries = remaining.filter((e) => e.mode === 'NORMAL');
  const candidates: (CandidateInput & { socketId: string })[] = await Promise.all(
    normalEntries.map(async (e) => ({
      userId: e.userId,
      rating: e.user.currentRating,
      enteredAt: e.enteredAt,
      blockedOpponents: await getRecentOpponents(prisma, e.userId),
      averageStarRating: e.user.averageStarRating,
      socketId: e.socketId ?? '',
    })),
  );

  const { matched } = findAllMatches(candidates, now);

  // イベントキュー: レート差無視のFIFOペアリング
  const eventEntries = [...remaining.filter((e) => e.mode === 'EVENT')].sort(
    (a, b) => a.enteredAt.getTime() - b.enteredAt.getTime(),
  );

  interface PairPlan {
    a: string;
    b: string;
    aSock: string;
    bSock: string;
    mode: MatchMode;
  }
  const pairs: PairPlan[] = matched.map(([a, b]) => ({
    a: a.userId,
    b: b.userId,
    aSock: candidates.find((c) => c.userId === a.userId)?.socketId ?? '',
    bSock: candidates.find((c) => c.userId === b.userId)?.socketId ?? '',
    mode: 'NORMAL',
  }));
  for (let i = 0; i + 1 < eventEntries.length; i += 2) {
    pairs.push({
      a: eventEntries[i].userId,
      b: eventEntries[i + 1].userId,
      aSock: '',
      bSock: '',
      mode: 'EVENT',
    });
  }

  const matches: TickResult['matches'] = [];
  for (const pair of pairs) {
    const result = await prisma.$transaction(async (tx) => {
      // キューから両者を削除
      await tx.queueEntry.deleteMany({
        where: { userId: { in: [pair.a, pair.b] } },
      });

      const userA = await tx.user.findUnique({ where: { id: pair.a } });
      const userB = await tx.user.findUnique({ where: { id: pair.b } });
      if (!userA || !userB) throw new Error('User vanished during tick match');

      const match = await tx.match.create({
        data: {
          player1Id: pair.a,
          player2Id: pair.b,
          status: 'PENDING_TOSS',
          mode: pair.mode,
        },
      });

      // イベント戦は再マッチ制限の対象にしない
      if (pair.mode === 'NORMAL') {
        await tx.recentOpponent.createMany({
          data: [
            { userId: pair.a, opponentId: pair.b, matchId: match.id },
            { userId: pair.b, opponentId: pair.a, matchId: match.id },
          ],
        });
      }

      return { match, userA, userB };
    });

    matches.push({
      match: result.match,
      player1: result.userA,
      player2: result.userB,
      player1SocketId: pair.aSock,
      player2SocketId: pair.bSock,
    });
  }

  return {
    timedOutUserIds: expired.map((e) => e.userId),
    matches,
  };
}

/**
 * ユーザーの直近対戦相手を取得（最大2件）
 */
async function getRecentOpponents(prisma: PrismaClient, userId: string): Promise<string[]> {
  // テスト用フラグ: 再マッチ制限を無効化（.env: DISABLE_REMATCH_BLOCK=true）
  if (env.DISABLE_REMATCH_BLOCK) return [];
  const recents = await prisma.recentOpponent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: RECENT_OPPONENTS_BLOCK_COUNT,
  });
  return recents.map((r) => r.opponentId);
}

/**
 * 自分以外の全キューエントリを CandidateInput として取得
 */
async function loadCandidates(
  prisma: PrismaClient,
  myUserId: string,
  mode: MatchMode = 'NORMAL',
): Promise<CandidateInput[]> {
  const entries = await prisma.queueEntry.findMany({
    where: { userId: { not: myUserId }, mode },
    include: { user: true },
  });

  return Promise.all(
    entries.map(async (e) => ({
      userId: e.userId,
      rating: e.user.currentRating,
      enteredAt: e.enteredAt,
      blockedOpponents: mode === 'EVENT' ? [] : await getRecentOpponents(prisma, e.userId),
      averageStarRating: e.user.averageStarRating,
    })),
  );
}
