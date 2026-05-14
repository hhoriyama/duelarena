import { Router } from 'express';
import type { ReportCategory } from '@prisma/client';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { toUserPublic } from '../services/user-service';
import { rateOpponent } from '../services/star-rating-service';
import { createReport } from '../services/report-service';

const router = Router();

/**
 * GET /api/matches/:id
 *   試合詳細を取得（参加者または管理者のみ）
 */
router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: {
      player1: true,
      player2: true,
      ratingHistories: { where: { userId: req.auth.userId } },
      reports: true,
    },
  });
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  if (
    match.player1Id !== req.auth.userId &&
    match.player2Id !== req.auth.userId &&
    !req.auth.isAdmin
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({
    match: {
      id: match.id,
      status: match.status,
      winnerId: match.winnerId,
      tossById: match.tossById,
      player1Accepted: match.player1Accepted,
      player2Accepted: match.player2Accepted,
      acceptedAt: match.acceptedAt?.toISOString() ?? null,
      reportedAt: match.reportedAt?.toISOString() ?? null,
      startedAt: match.startedAt.toISOString(),
      endedAt: match.endedAt?.toISOString() ?? null,
      player1: toUserPublic(match.player1),
      player2: toUserPublic(match.player2),
    },
    myRatingDelta: match.ratingHistories[0]?.delta ?? null,
    reports: match.reports.map((r) => ({
      reporterId: r.reporterId,
      reportedWinnerId: r.reportedWinnerId,
      reportedAt: r.reportedAt.toISOString(),
    })),
  });
});

/**
 * GET /api/matches/me/history?limit=20&cursor=...
 *   自分の試合履歴
 */
router.get('/me/history', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: req.auth.userId }, { player2Id: req.auth.userId }],
      status: { in: ['COMPLETED', 'DRAW', 'CANCELLED', 'INTERRUPTED'] },
    },
    orderBy: { endedAt: 'desc' },
    take: limit,
    include: {
      player1: true,
      player2: true,
      ratingHistories: { where: { userId: req.auth.userId } },
    },
  });

  res.json({
    matches: matches.map((m) => {
      const isPlayer1 = m.player1Id === req.auth!.userId;
      const opponent = isPlayer1 ? m.player2 : m.player1;
      const myDelta = m.ratingHistories[0]?.delta ?? 0;
      let result: 'WIN' | 'LOSS' | 'DRAW' | 'TOSSED_BY_ME' | 'TOSSED_BY_OPPONENT' | 'OTHER' =
        'OTHER';
      if (m.status === 'DRAW') result = 'DRAW';
      else if (m.status === 'COMPLETED') {
        if (m.tossById) {
          result = m.tossById === req.auth!.userId ? 'TOSSED_BY_ME' : 'TOSSED_BY_OPPONENT';
        } else if (m.winnerId === req.auth!.userId) result = 'WIN';
        else result = 'LOSS';
      }

      return {
        id: m.id,
        status: m.status,
        result,
        myRatingDelta: myDelta,
        opponent: toUserPublic(opponent),
        endedAt: m.endedAt?.toISOString() ?? null,
        startedAt: m.startedAt.toISOString(),
      };
    }),
  });
});

/**
 * POST /api/matches/:id/star-rating
 *   試合相手に星評価をつける
 */
router.post('/:id/star-rating', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { stars } = req.body ?? {};
  if (typeof stars !== 'number') {
    res.status(400).json({ error: 'starsは数値で指定してください' });
    return;
  }
  try {
    const result = await rateOpponent(prisma, req.params.id, req.auth.userId, stars);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/matches/:id/report-user
 *   試合相手を通報
 */
router.post('/:id/report-user', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { category, description, evidenceUrls } = req.body ?? {};
  if (typeof category !== 'string' || typeof description !== 'string') {
    res.status(400).json({ error: 'category と description が必要です' });
    return;
  }
  try {
    const result = await createReport(
      prisma,
      req.params.id,
      req.auth.userId,
      category as ReportCategory,
      description,
      Array.isArray(evidenceUrls) ? evidenceUrls : [],
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/matches/me/active
 *   自分の進行中の試合（あれば）
 */
router.get('/me/active', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const match = await prisma.match.findFirst({
    where: {
      OR: [{ player1Id: req.auth.userId }, { player2Id: req.auth.userId }],
      status: { in: ['PENDING_TOSS', 'IN_PROGRESS', 'WAITING_APPROVAL'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ matchId: match?.id ?? null, status: match?.status ?? null });
});

export default router;
