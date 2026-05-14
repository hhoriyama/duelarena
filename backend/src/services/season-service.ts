import type { PrismaClient, Season, User } from '@prisma/client';
import { computeSeasonRange, determineTitle, RESET_RATING } from './season-core';

/**
 * 現在アクティブなシーズンを取得する。なければ自動でシード作成。
 */
export async function getOrCreateCurrentSeason(prisma: PrismaClient): Promise<Season> {
  const active = await prisma.season.findFirst({ where: { isActive: true } });
  if (active) return active;

  const now = new Date();
  const range = computeSeasonRange(now);
  const count = await prisma.season.count();
  const seasonName = `シーズン${count + 1}`;

  return prisma.season.create({
    data: {
      name: seasonName,
      startAt: range.start,
      endAt: range.end,
      isActive: true,
    },
  });
}

export interface LeaderboardEntry {
  rank: number;
  user: User;
}

/**
 * 現シーズンのリーダーボードを取得（レート降順）
 */
export async function getSeasonLeaderboard(
  prisma: PrismaClient,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: { isBanned: false, matchCount: { gt: 0 } },
    orderBy: [
      { currentRating: 'desc' },
      { wins: 'desc' },
      { matchCount: 'asc' },
    ],
    take: limit,
  });
  return users.map((u, i) => ({ rank: i + 1, user: u }));
}

export interface MonthlyStats {
  yearMonth: string; // YYYY-MM
  topWinners: Array<{ user: User; wins: number }>;
}

/**
 * 月間統計：指定月の最多勝利者ランキング
 */
export async function getMonthlyStats(
  prisma: PrismaClient,
  year: number,
  month: number, // 1-12
  limit = 10,
): Promise<MonthlyStats> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const matches = await prisma.match.findMany({
    where: {
      status: 'COMPLETED',
      endedAt: { gte: start, lt: end },
      winnerId: { not: null },
    },
    select: { winnerId: true },
  });

  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.winnerId) counts.set(m.winnerId, (counts.get(m.winnerId) ?? 0) + 1);
  }

  const sortedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const userIds = sortedIds.map(([id]) => id);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const topWinners = sortedIds
    .map(([id, wins]) => {
      const user = userMap.get(id);
      return user ? { user, wins } : null;
    })
    .filter((v): v is { user: User; wins: number } => v !== null);

  return {
    yearMonth: `${year}-${String(month).padStart(2, '0')}`,
    topWinners,
  };
}

/**
 * シーズン終了：レーティング完全リセット + 称号付与 + 新シーズン開始
 *
 * - 終了対象シーズンの参加者順位を確定
 * - 称号を生成
 * - 全ユーザーのレートを 1500 にリセット
 * - 新シーズンを作成
 */
export async function endSeasonAndStartNew(
  prisma: PrismaClient,
): Promise<{ endedSeason: Season; newSeason: Season; titlesGranted: number }> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.season.findFirst({ where: { isActive: true } });
    if (!current) throw new Error('アクティブなシーズンがありません');

    // 順位を確定（試合経験者のみ）
    const ranked = await tx.user.findMany({
      where: { isBanned: false, matchCount: { gt: 0 } },
      orderBy: [
        { currentRating: 'desc' },
        { wins: 'desc' },
        { matchCount: 'asc' },
      ],
    });

    let titlesGranted = 0;
    for (let i = 0; i < ranked.length; i++) {
      const u = ranked[i];
      const title = determineTitle(current.name, i + 1, ranked.length);
      if (title) {
        await tx.seasonTitle.create({
          data: {
            seasonId: current.id,
            userId: u.id,
            rank: i + 1,
            title,
          },
        });
        titlesGranted++;
      }
    }

    // 完全リセット
    await tx.user.updateMany({
      data: {
        currentRating: RESET_RATING,
        highestRating: RESET_RATING,
        wins: 0,
        losses: 0,
        draws: 0,
        matchCount: 0,
        consecutiveTossCount: 0,
      },
    });

    // 旧シーズンを終了
    const endedSeason = await tx.season.update({
      where: { id: current.id },
      data: { isActive: false },
    });

    // 新シーズン
    const now = new Date();
    const range = computeSeasonRange(now);
    const allCount = await tx.season.count();
    const newSeason = await tx.season.create({
      data: {
        name: `シーズン${allCount + 1}`,
        startAt: range.start,
        endAt: range.end,
        isActive: true,
      },
    });

    return { endedSeason, newSeason, titlesGranted };
  });
}
