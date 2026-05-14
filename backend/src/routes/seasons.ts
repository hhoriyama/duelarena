import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  getOrCreateCurrentSeason,
  getSeasonLeaderboard,
  getMonthlyStats,
} from '../services/season-service';
import { toUserPublic } from '../services/user-service';

const router = Router();

/**
 * GET /api/seasons/current
 *   現シーズン情報
 */
router.get('/current', requireAuth, async (_req, res) => {
  const season = await getOrCreateCurrentSeason(prisma);
  res.json({
    id: season.id,
    name: season.name,
    startAt: season.startAt.toISOString(),
    endAt: season.endAt.toISOString(),
    isActive: season.isActive,
  });
});

/**
 * GET /api/seasons/leaderboard?limit=50
 *   現シーズンのリーダーボード
 */
router.get('/leaderboard', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const entries = await getSeasonLeaderboard(prisma, limit);
  res.json({
    entries: entries.map((e) => ({
      rank: e.rank,
      user: toUserPublic(e.user),
    })),
  });
});

/**
 * GET /api/seasons/monthly?year=2026&month=5
 *   月間統計（最多勝利者）
 */
router.get('/monthly', requireAuth, async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year ?? now.getUTCFullYear());
  const month = Number(req.query.month ?? now.getUTCMonth() + 1);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    res.status(400).json({ error: 'Invalid year or month' });
    return;
  }
  const stats = await getMonthlyStats(prisma, year, month);
  res.json({
    yearMonth: stats.yearMonth,
    topWinners: stats.topWinners.map((w) => ({
      user: toUserPublic(w.user),
      wins: w.wins,
    })),
  });
});

/**
 * GET /api/seasons/me/titles
 *   自分の獲得称号
 */
router.get('/me/titles', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const titles = await prisma.seasonTitle.findMany({
    where: { userId: req.auth.userId },
    include: { season: true },
    orderBy: { id: 'desc' },
  });
  res.json({
    titles: titles.map((t) => ({
      title: t.title,
      rank: t.rank,
      seasonName: t.season.name,
      seasonEndedAt: t.season.endAt.toISOString(),
    })),
  });
});

export default router;
