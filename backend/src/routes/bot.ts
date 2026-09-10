import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  requireBotAuth,
  resolveBotUser,
  isBotAdmin,
  type BotRequest,
} from '../middleware/bot-auth';
import { isEventOpen, setEventOpen } from '../services/settings';
import { enterQueue, leaveQueue, getQueueState } from '../services/matchmaking';
import { acceptMatch, tossMatch } from '../services/toss-service';
import {
  reportWin,
  approveReport,
  rejectReport,
} from '../services/match-report-service';
import {
  beginMatchForBot,
  announceMatchFound,
} from '../services/matchmaker-loop';
import {
  enqueueMatchEvent,
  discordIdOf,
  getPendingOutbox,
  ackOutbox,
} from '../services/outbox';
import { toUserPublic } from '../services/user-service';

const router = Router();

// すべての /api/bot/* は Bot 認証必須
router.use(requireBotAuth);

// ===== キュー =====

router.post('/queue/enter', async (req: BotRequest, res: Response) => {
  try {
    const user = await resolveBotUser(req);
    const channelId =
      typeof req.body?.channelId === 'string' ? req.body.channelId : undefined;
    const mode = req.body?.mode === 'EVENT' ? ('EVENT' as const) : ('NORMAL' as const);
    if (mode === 'EVENT' && !(await isEventOpen(prisma))) {
      res.status(400).json({ error: 'イベントは現在開催されていません' });
      return;
    }
    const result = await enterQueue(prisma, user.id, undefined, {
      source: 'DISCORD',
      channelId,
      mode,
    });

    if (result.matched) {
      await beginMatchForBot(prisma, result.match.id);
      await announceMatchFound(prisma, result.match);
      res.json({ matched: true, matchId: result.match.id });
      return;
    }
    res.json({
      matched: false,
      enteredAt: result.enteredAt.toISOString(),
      ratingAtEntry: result.ratingAtEntry,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/queue/leave', async (req: BotRequest, res: Response) => {
  const user = await resolveBotUser(req);
  await leaveQueue(prisma, user.id);
  res.json({ ok: true });
});

router.get('/queue/status', async (req: BotRequest, res: Response) => {
  const user = await resolveBotUser(req);
  const state = await getQueueState(prisma, user.id);
  const waitingSeconds = state.enteredAt
    ? Math.floor((Date.now() - state.enteredAt.getTime()) / 1000)
    : undefined;
  res.json({
    inQueue: state.inQueue,
    waitingSeconds,
    currentRange: state.currentRange,
    ratingAtEntry: state.ratingAtEntry,
    mode: state.mode,
  });
});

// ===== イベント開催管理（ADMIN_DISCORD_IDS の管理者のみ） =====

router.post('/event/open', async (req: BotRequest, res: Response) => {
  if (!isBotAdmin(req.botDiscordId as string)) {
    res.status(403).json({ error: '管理者のみ実行できます' });
    return;
  }
  await setEventOpen(prisma, true);
  res.json({ open: true });
});

router.post('/event/close', async (req: BotRequest, res: Response) => {
  if (!isBotAdmin(req.botDiscordId as string)) {
    res.status(403).json({ error: '管理者のみ実行できます' });
    return;
  }
  await setEventOpen(prisma, false);
  // 受付終了と同時にイベント待機列を空にする（進行中の試合はそのまま完走）
  await prisma.queueEntry.deleteMany({ where: { mode: 'EVENT' } });
  res.json({ open: false });
});

router.get('/event/status', async (_req: BotRequest, res: Response) => {
  res.json({ open: await isEventOpen(prisma) });
});

// ===== 試合 =====

router.post('/matches/:id/accept', async (req: BotRequest, res: Response) => {
  try {
    const user = await resolveBotUser(req);
    const result = await acceptMatch(prisma, req.params.id as string, user.id);
    if (result.bothAccepted) {
      await enqueueMatchEvent(prisma, 'MATCH_STARTED', result.match, {
        summary: '両者が承認しました。対戦を開始してください。',
      });
    }
    res.json({ status: result.match.status });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/matches/:id/toss', async (req: BotRequest, res: Response) => {
  try {
    const user = await resolveBotUser(req);
    const result = await tossMatch(prisma, req.params.id as string, user.id);
    await enqueueMatchEvent(prisma, 'RESULT_CONFIRMED', result.match, {
      summary: 'トスにより試合が終了しました。',
    });
    res.json({ status: result.match.status });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/matches/:id/report', async (req: BotRequest, res: Response) => {
  try {
    const user = await resolveBotUser(req);
    const matchId = req.params.id as string;

    // 報告者視点の勝敗（WIN=自分が勝ち / LOSE=自分が負け＝相手勝ち）で受ける。
    // Botは相手のIDを知らなくてよい（Backendが試合の2人から勝者を解決する）。
    const result_ = typeof req.body?.result === 'string' ? req.body.result : null;
    if (result_ !== 'WIN' && result_ !== 'LOSE') {
      res.status(400).json({ error: 'result must be WIN or LOSE' });
      return;
    }
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      res.status(404).json({ error: 'match not found' });
      return;
    }
    if (match.player1Id !== user.id && match.player2Id !== user.id) {
      res.status(403).json({ error: 'not a participant' });
      return;
    }
    const opponentId =
      match.player1Id === user.id ? match.player2Id : match.player1Id;
    const winnerId = result_ === 'WIN' ? user.id : opponentId;

    const result = await reportWin(prisma, matchId, user.id, winnerId);

    if (result.outcome === 'WAITING') {
      // もう一方（承認者）へ承認/異議を促す
      const approverId =
        result.match.player1Id === user.id
          ? result.match.player2Id
          : result.match.player1Id;
      const approverDiscordId = await discordIdOf(prisma, approverId);
      // 承認者が「誰が・どちらの勝ちと報告したか」を確認できるよう内容を載せる
      const reportedWinnerDiscordId =
        winnerId === user.id ? user.discordId : await discordIdOf(prisma, winnerId);
      await enqueueMatchEvent(prisma, 'REPORT_RECEIVED', result.match, {
        approverDiscordId: approverDiscordId ?? undefined,
        reporterDiscordId: user.discordId,
        reportedWinnerDiscordId: reportedWinnerDiscordId ?? undefined,
        summary: '相手が結果を報告しました。承認するか異議を申し立ててください。',
      });
    } else if (result.outcome === 'COMPLETED' && result.finalize) {
      await enqueueMatchEvent(prisma, 'RESULT_CONFIRMED', result.match, {
        winnerDiscordId: result.finalize.winner.discordId,
        winnerDelta: result.finalize.winnerDelta,
        loserDelta: result.finalize.loserDelta,
        summary: '結果が確定しました。',
      });
    } else if (result.outcome === 'DISPUTED') {
      await enqueueMatchEvent(prisma, 'MATCH_CANCELLED', result.match, {
        summary: '報告が食い違ったため、管理者の裁定待ちになりました。',
      });
    }

    res.json({ outcome: result.outcome, status: result.match.status });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/matches/:id/approve', async (req: BotRequest, res: Response) => {
  try {
    const user = await resolveBotUser(req);
    const result = await approveReport(prisma, req.params.id as string, user.id);
    if (result.outcome === 'COMPLETED' && result.finalize) {
      await enqueueMatchEvent(prisma, 'RESULT_CONFIRMED', result.match, {
        winnerDiscordId: result.finalize.winner.discordId,
        winnerDelta: result.finalize.winnerDelta,
        loserDelta: result.finalize.loserDelta,
        summary: '結果が承認され、確定しました。',
      });
    }
    res.json({ outcome: result.outcome, status: result.match.status, mode: result.match.mode });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/matches/:id/reject', async (req: BotRequest, res: Response) => {
  try {
    const user = await resolveBotUser(req);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    const result = await rejectReport(
      prisma,
      req.params.id as string,
      user.id,
      reason,
      [],
    );
    await enqueueMatchEvent(prisma, 'MATCH_CANCELLED', result.match, {
      summary: '異議が申し立てられました。管理者の裁定をお待ちください。',
    });
    res.json({ status: result.match.status });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ===== プロフィール / 履歴 =====

router.get('/profile', async (req: BotRequest, res: Response) => {
  const self = await resolveBotUser(req);
  const target =
    typeof req.query.target === 'string' && req.query.target
      ? await prisma.user.findUnique({ where: { discordId: req.query.target } })
      : self;
  if (!target) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  res.json(toUserPublic(target));
});

router.get('/history', async (req: BotRequest, res: Response) => {
  const user = await resolveBotUser(req);
  const limit = Math.min(Number(req.query.limit ?? 10), 50);

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: user.id }, { player2Id: user.id }],
      status: { in: ['COMPLETED', 'DRAW', 'CANCELLED', 'INTERRUPTED'] },
    },
    orderBy: { endedAt: 'desc' },
    take: limit,
    include: { ratingHistories: { where: { userId: user.id } } },
  });

  res.json({
    matches: matches.map((m) => {
      let result: 'WIN' | 'LOSE' | 'DRAW' | '—' = '—';
      if (m.status === 'DRAW') result = 'DRAW';
      else if (m.status === 'INTERRUPTED') result = 'LOSE'; // 時間切れ＝両者敗北
      else if (m.winnerId) result = m.winnerId === user.id ? 'WIN' : 'LOSE';
      return { matchId: m.id, result, delta: m.ratingHistories[0]?.delta ?? 0 };
    }),
  });
});

// ===== イベント配信（outbox ポーリング）=====

router.get('/events/pending', async (_req: BotRequest, res: Response) => {
  const events = await getPendingOutbox(prisma);
  res.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      matchId: e.matchId,
      payload: e.payload,
    })),
  });
});

router.post('/events/ack', async (req: BotRequest, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
  await ackOutbox(prisma, ids);
  res.json({ acked: ids.length });
});

export default router;
