import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getEventSummary } from '../services/event-service';

/**
 * ログイン不要の公開API（Web閲覧ページ用）。
 * 個人を特定しうる情報は username / avatar のみに絞る（discordId は出さない）。
 */
const router = Router();

/** GET /api/public/leaderboard?limit=100 — レート順ランキング */
router.get('/leaderboard', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);
  const users = await prisma.user.findMany({
    where: { isBanned: false, matchCount: { gt: 0 } },
    orderBy: [{ currentRating: 'desc' }, { username: 'asc' }],
    take: limit,
  });
  res.json({
    users: users.map((u, i) => ({
      rank: i + 1,
      username: u.username,
      avatarUrl: u.avatarUrl,
      rating: u.currentRating,
      wins: u.wins,
      losses: u.losses,
      draws: u.draws,
      matchCount: u.matchCount,
    })),
  });
});

/** GET /api/public/matches?limit=50 — 直近の確定試合 */
router.get('/matches', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 100);
  const matches = await prisma.match.findMany({
    where: { status: { in: ['COMPLETED', 'DRAW'] } },
    orderBy: { endedAt: 'desc' },
    take: limit,
    include: { player1: true, player2: true, ratingHistories: true },
  });
  res.json({
    matches: matches.map((m) => {
      const deltaOf = (userId: string): number | null =>
        m.ratingHistories.find((h) => h.userId === userId)?.delta ?? null;
      return {
        id: m.id,
        endedAt: m.endedAt?.toISOString() ?? null,
        status: m.status,
        player1: {
          username: m.player1.username,
          avatarUrl: m.player1.avatarUrl,
          delta: deltaOf(m.player1Id),
        },
        player2: {
          username: m.player2.username,
          avatarUrl: m.player2.avatarUrl,
          delta: deltaOf(m.player2Id),
        },
        winner:
          m.winnerId === m.player1Id
            ? 'player1'
            : m.winnerId === m.player2Id
              ? 'player2'
              : null,
      };
    }),
  });
});

/** GET /api/public/event — イベント順位表（最後の開催開始以降の集計） */
router.get('/event', async (_req: Request, res: Response) => {
  const summary = await getEventSummary(prisma);
  res.json({
    open: summary.open,
    openedAt: summary.openedAt,
    standings: summary.standings.map((s, i) => ({
      rank: i + 1,
      username: s.username,
      avatarUrl: s.avatarUrl,
      wins: s.wins,
      losses: s.losses,
    })),
  });
});

export default router;
