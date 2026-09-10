import { Router } from 'express';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  getDashboardStats,
  searchUsers,
  banUser,
  unbanUser,
  adjustRating,
  listOpenDisputes,
  resolveDispute,
} from '../services/admin-service';
import { toUserPublic } from '../services/user-service';
import { getEventSummary } from '../services/event-service';

const router = Router();

router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/event/draw?minWins=N — イベントの抽選
 *
 * - topWinners: 最多勝利者（同数勝利は全員）→ 確定プレゼント枠
 * - candidates: 規定勝利数(minWins)以上のうち、最多勝利者を除いた人
 * - picked: candidates からランダムで1名
 *
 * 押すたびに picked は引き直される（結果の確定は管理者の手動運用）。
 */
router.get('/event/draw', async (req, res) => {
  const minWins = Math.max(1, Number(req.query.minWins ?? 3) || 3);
  const summary = await getEventSummary(prisma);
  const standings = summary.standings.filter((s) => s.wins > 0);

  if (standings.length === 0) {
    res.json({ minWins, maxWins: 0, topWinners: [], candidates: [], picked: null });
    return;
  }

  const maxWins = standings[0].wins;
  const topWinners = standings.filter((s) => s.wins === maxWins);
  const topIds = new Set(topWinners.map((s) => s.discordId));
  const candidates = standings.filter((s) => s.wins >= minWins && !topIds.has(s.discordId));
  const picked =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : null;

  const pub = (s: { username: string; wins: number; losses: number }) => ({
    username: s.username,
    wins: s.wins,
    losses: s.losses,
  });
  res.json({
    minWins,
    maxWins,
    topWinners: topWinners.map(pub),
    candidates: candidates.map(pub),
    picked: picked ? pub(picked) : null,
  });
});

/**
 * GET /api/admin/dashboard
 */
router.get('/dashboard', async (_req, res) => {
  const stats = await getDashboardStats(prisma);
  res.json(stats);
});

/**
 * GET /api/admin/users/search?q=...
 */
router.get('/users/search', async (req, res) => {
  const q = String(req.query.q ?? '');
  const users = await searchUsers(prisma, q);
  res.json({
    users: users.map((u) => ({
      ...toUserPublic(u),
      isBanned: u.isBanned,
    })),
  });
});

/**
 * POST /api/admin/users/:id/ban
 */
router.post('/users/:id/ban', async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { reason } = req.body ?? {};
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    res.status(400).json({ error: 'reasonが必要です' });
    return;
  }
  try {
    const user = await banUser(prisma, req.params.id as string, reason, req.auth.discordId);
    res.json({ user: toUserPublic(user), isBanned: user.isBanned });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/admin/users/:id/unban
 */
router.post('/users/:id/unban', async (req, res) => {
  try {
    const user = await unbanUser(prisma, req.params.id);
    res.json({ user: toUserPublic(user), isBanned: user.isBanned });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/admin/users/:id/adjust-rating
 *   body: { rating: number, reason: string }
 */
router.post('/users/:id/adjust-rating', async (req, res) => {
  const { rating, reason } = req.body ?? {};
  if (typeof rating !== 'number' || typeof reason !== 'string') {
    res.status(400).json({ error: 'rating と reason が必要です' });
    return;
  }
  try {
    const user = await adjustRating(prisma, req.params.id, rating, reason);
    res.json({ user: toUserPublic(user) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/admin/disputes
 */
router.get('/disputes', async (_req, res) => {
  const disputes = await listOpenDisputes(prisma);
  res.json({
    disputes: disputes.map((d) => ({
      id: d.dispute.id,
      matchId: d.match.id,
      description: d.dispute.description,
      evidenceUrls: d.dispute.evidenceUrls,
      raisedById: d.dispute.raisedById,
      createdAt: d.dispute.createdAt.toISOString(),
      player1: toUserPublic(d.player1),
      player2: toUserPublic(d.player2),
      reports: d.reports,
    })),
  });
});

/**
 * POST /api/admin/disputes/:id/resolve
 *   body: { winnerId: string } または { cancel: true }
 */
router.post('/disputes/:id/resolve', async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const body = req.body ?? {};
  let resolution: { winnerId: string } | { cancel: true };
  if (body.cancel === true) {
    resolution = { cancel: true };
  } else if (typeof body.winnerId === 'string') {
    resolution = { winnerId: body.winnerId };
  } else {
    res.status(400).json({ error: 'winnerId または cancel:true が必要です' });
    return;
  }
  try {
    const result = await resolveDispute(prisma, req.params.id as string, req.auth.discordId, resolution);
    res.json({
      matchId: result.match.id,
      matchStatus: result.match.status,
      disputeStatus: result.dispute.status,
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

export default router;
