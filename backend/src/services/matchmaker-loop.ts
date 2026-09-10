import type { PrismaClient, Match } from '@prisma/client';
import { env } from '../config/env';
import { tick } from './matchmaking';
import { tickMatchTimeouts, DRAW_TIMEOUT_MS } from './match-report-service';
import { enqueueMatchEvent, discordIdOf } from './outbox';

/**
 * Socket非依存の常駐マッチングワーカー。DESIGN.md §4/§5。
 *
 * Web版では Socket.IO の tick ループがマッチングを回していたが、Bot版では
 * ソケット接続に依存しないこの常駐ループが唯一のマッチング駆動源になる。
 * マッチ成立・確定はすべて outbox に積み、Botがポーリングで拾う。
 */

/**
 * Discord経由のマッチはトス/承認フェーズを踏まず、成立即 IN_PROGRESS にする
 * （UIはWin/Lose直行。DESIGN.md §6）。40分引き分けタイマー起点として acceptedAt も打つ。
 */
export async function beginMatchForBot(
  prisma: PrismaClient,
  matchId: string,
): Promise<Match | null> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return null;
  if (match.status !== 'PENDING_TOSS') return match;
  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'IN_PROGRESS',
      player1Accepted: true,
      player2Accepted: true,
      acceptedAt: new Date(),
    },
  });
}

/** マッチ成立を outbox に積む（両者へ通知）。 */
export async function announceMatchFound(
  prisma: PrismaClient,
  match: Pick<Match, 'id' | 'player1Id' | 'player2Id'>,
): Promise<void> {
  await enqueueMatchEvent(prisma, 'MATCH_FOUND', match, {
    summary: 'マッチが成立しました。勝負後、結果を報告してください。',
  });
}

let matchmakerTimer: NodeJS.Timeout | null = null;
let finalizeTimer: NodeJS.Timeout | null = null;

/** 常駐マッチングループを開始する。 */
export function startMatchmakerLoop(prisma: PrismaClient): void {
  if (matchmakerTimer) return;
  matchmakerTimer = setInterval(async () => {
    try {
      const result = await tick(prisma);
      for (const m of result.matches) {
        await beginMatchForBot(prisma, m.match.id);
        await announceMatchFound(prisma, m.match);
      }
    } catch (err) {
      console.error('[matchmaker-loop] error:', err);
    }
  }, env.MATCHMAKER_TICK_MS);
  console.log(`[matchmaker-loop] started (interval=${env.MATCHMAKER_TICK_MS}ms)`);
}

/** 5分自動承認 / 40分引き分けの常駐チェッカー。確定を outbox に積む。 */
export function startMatchFinalizeLoop(prisma: PrismaClient): void {
  if (finalizeTimer) return;
  finalizeTimer = setInterval(async () => {
    try {
      // 残り時間リマインダー（残り10分/5分に両者メンション）
      await tickReminders(prisma);

      const result = await tickMatchTimeouts(prisma);

      for (const r of result.autoApproved) {
        if (!r.finalize) continue;
        await enqueueMatchEvent(prisma, 'RESULT_CONFIRMED', r.match, {
          winnerDiscordId: r.finalize.winner.discordId,
          winnerDelta: r.finalize.winnerDelta,
          loserDelta: r.finalize.loserDelta,
          summary: '5分経過により結果が自動承認されました。',
        });
      }

      for (const m of result.drawn) {
        await enqueueMatchEvent(prisma, 'RESULT_CONFIRMED', m, {
          timeout: true,
          summary: '制限時間（40分）を超過したため、両者敗北として記録されました。',
        });
      }
    } catch (err) {
      console.error('[match-finalize-loop] error:', err);
    }
  }, env.MATCH_TIMEOUT_TICK_MS);
  console.log(`[match-finalize-loop] started (interval=${env.MATCH_TIMEOUT_TICK_MS}ms)`);
}

/**
 * 進行中の試合に対する残り時間リマインダー。
 * 残り10分・残り5分の各タイミングで一度だけ MATCH_REMINDER を outbox に積む。
 * 送信済みフラグは matches.reminder10SentAt / reminder5SentAt で管理（再送防止）。
 */
async function tickReminders(prisma: PrismaClient): Promise<void> {
  const now = Date.now();
  const inProgress = await prisma.match.findMany({ where: { status: 'IN_PROGRESS' } });

  for (const m of inProgress) {
    if (!m.acceptedAt) continue;
    const remainingMs = m.acceptedAt.getTime() + DRAW_TIMEOUT_MS - now;
    if (remainingMs <= 0) continue; // タイムアウト処理側に任せる

    if (remainingMs <= 5 * 60_000 && !m.reminder5SentAt) {
      await prisma.match.update({
        where: { id: m.id },
        data: {
          reminder5SentAt: new Date(),
          // 10分リマインダーを飛ばしていた場合も二重送信しないよう埋める
          reminder10SentAt: m.reminder10SentAt ?? new Date(),
        },
      });
      await enqueueMatchEvent(prisma, 'MATCH_REMINDER', m, { remainingMinutes: 5 });
    } else if (remainingMs <= 10 * 60_000 && !m.reminder10SentAt) {
      await prisma.match.update({
        where: { id: m.id },
        data: { reminder10SentAt: new Date() },
      });
      await enqueueMatchEvent(prisma, 'MATCH_REMINDER', m, { remainingMinutes: 10 });
    }
  }
}

// discordIdOf を利用する箇所向けに re-export（bot routes から使う）。
export { discordIdOf };
