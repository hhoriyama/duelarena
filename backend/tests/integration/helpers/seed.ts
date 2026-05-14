import type { Match, MatchStatus, User } from '@prisma/client';
import { testPrisma } from './db';

let userCounter = 0;
let matchCounter = 0;

/**
 * テスト用ユーザーを作成
 */
export async function createUser(overrides: Partial<User> = {}): Promise<User> {
  userCounter += 1;
  return testPrisma.user.create({
    data: {
      discordId: overrides.discordId ?? `discord-${userCounter}-${Date.now()}`,
      username: overrides.username ?? `TestUser${userCounter}`,
      avatarUrl: overrides.avatarUrl ?? `https://example.com/avatar-${userCounter}.png`,
      currentRating: overrides.currentRating ?? 1500,
      highestRating: overrides.highestRating ?? 1500,
      wins: overrides.wins ?? 0,
      losses: overrides.losses ?? 0,
      draws: overrides.draws ?? 0,
      matchCount: overrides.matchCount ?? 0,
      consecutiveTossCount: overrides.consecutiveTossCount ?? 0,
      averageStarRating: overrides.averageStarRating ?? null,
      isBanned: overrides.isBanned ?? false,
    },
  });
}

/**
 * 試合経験を持ったユーザーを作成（K値を normal にしたいときなど）
 */
export async function createVeteranUser(
  overrides: Partial<User> = {},
): Promise<User> {
  return createUser({ matchCount: 50, wins: 25, losses: 25, ...overrides });
}

/**
 * テスト用の試合を作成
 */
export async function createMatch(
  player1Id: string,
  player2Id: string,
  overrides: { status?: MatchStatus } & Partial<Match> = {},
): Promise<Match> {
  matchCounter += 1;
  return testPrisma.match.create({
    data: {
      player1Id,
      player2Id,
      status: overrides.status ?? 'PENDING_TOSS',
      ...overrides,
    },
  });
}

/**
 * キューに直接エントリを追加
 */
export async function createQueueEntry(
  userId: string,
  rating: number,
  enteredAt: Date = new Date(),
  socketId = 'fake-socket',
): Promise<void> {
  await testPrisma.queueEntry.create({
    data: {
      userId,
      ratingAtEntry: rating,
      enteredAt,
      socketId,
    },
  });
}
