import type { Server, Socket } from 'socket.io';
import type { Match } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { acceptMatch, tossMatch } from '../services/toss-service';
import {
  reportWin,
  approveReport,
  rejectReport,
  tickMatchTimeouts,
  type ReportResult,
} from '../services/match-report-service';
import { toUserPublic } from '../services/user-service';
import { teardownMatchChannel } from '../discord/voice-channel-service';
import { globalTracker } from './connection-tracker';

const MATCH_TICK_INTERVAL_MS = 30_000;

export function registerMatchHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  socket.on('match:accept', async ({ matchId }: { matchId: string }) => {
    try {
      const result = await acceptMatch(prisma, matchId, userId);
      socket.emit('match:updated', { matchId, status: result.match.status });
      if (result.bothAccepted) {
        notifyMatchUpdate(io, result.match.player1Id, matchId, result.match.status);
        notifyMatchUpdate(io, result.match.player2Id, matchId, result.match.status);
      }
    } catch (err) {
      socket.emit('match:error', { message: (err as Error).message });
    }
  });

  socket.on('match:toss', async ({ matchId }: { matchId: string }) => {
    try {
      const result = await tossMatch(prisma, matchId, userId);
      const payload = {
        matchId,
        status: 'COMPLETED' as const,
        outcome: 'TOSSED' as const,
        tossById: userId,
        tosserDelta: result.tosserDelta,
        receiverDelta: result.receiverDelta,
      };
      // Discord VC 削除（非同期）
      teardownMatchChannel(prisma, matchId).catch((err) =>
        console.error('[discord] teardown failed', err),
      );
      notifyEvent(io, result.match.player1Id, 'match:ended', payload);
      notifyEvent(io, result.match.player2Id, 'match:ended', payload);
    } catch (err) {
      socket.emit('match:error', { message: (err as Error).message });
    }
  });

  socket.on(
    'match:report',
    async ({ matchId, winnerId }: { matchId: string; winnerId: string }) => {
      try {
        const result = await reportWin(prisma, matchId, userId, winnerId);
        emitReportResult(io, result);
      } catch (err) {
        socket.emit('match:error', { message: (err as Error).message });
      }
    },
  );

  socket.on('match:approve', async ({ matchId }: { matchId: string }) => {
    try {
      const result = await approveReport(prisma, matchId, userId);
      emitReportResult(io, result);
    } catch (err) {
      socket.emit('match:error', { message: (err as Error).message });
    }
  });

  socket.on(
    'match:reject',
    async ({
      matchId,
      description,
      evidenceUrls,
    }: {
      matchId: string;
      description: string;
      evidenceUrls?: string[];
    }) => {
      try {
        const result = await rejectReport(
          prisma,
          matchId,
          userId,
          description ?? '',
          evidenceUrls ?? [],
        );
        notifyMatchUpdate(io, result.match.player1Id, matchId, result.match.status);
        notifyMatchUpdate(io, result.match.player2Id, matchId, result.match.status);
      } catch (err) {
        socket.emit('match:error', { message: (err as Error).message });
      }
    },
  );
}

/**
 * ReportResult の outcome に応じて適切なイベントを通知する
 */
function emitReportResult(io: Server, result: ReportResult): void {
  const match = result.match;
  if (result.outcome === 'COMPLETED' && result.finalize) {
    const payload = {
      matchId: match.id,
      status: 'COMPLETED' as const,
      outcome: 'APPROVED' as const,
      winner: toUserPublic(result.finalize.winner),
      loser: toUserPublic(result.finalize.loser),
      winnerDelta: result.finalize.winnerDelta,
      loserDelta: result.finalize.loserDelta,
    };
    // Discord VC 削除
    teardownMatchChannel(prisma, match.id).catch((err) =>
      console.error('[discord] teardown failed', err),
    );
    notifyEvent(io, match.player1Id, 'match:ended', payload);
    notifyEvent(io, match.player2Id, 'match:ended', payload);
    return;
  }
  // WAITING / DISPUTED は status 通知のみ（フロントが再取得）
  notifyMatchUpdate(io, match.player1Id, match.id, match.status);
  notifyMatchUpdate(io, match.player2Id, match.id, match.status);
}

function notifyMatchUpdate(
  io: Server,
  userId: string,
  matchId: string,
  status: string,
): void {
  notifyEvent(io, userId, 'match:updated', { matchId, status });
}

function notifyEvent(
  io: Server,
  userId: string,
  event: string,
  payload: unknown,
): void {
  const sid = globalTracker.getSocketId(userId);
  if (!sid) return;
  io.to(sid).emit(event, payload);
}

/**
 * 5分自動承認 / 40分引き分け のチェッカー
 */
export function startMatchTimeoutLoop(io: Server): void {
  setInterval(async () => {
    try {
      const result = await tickMatchTimeouts(prisma);

      for (const r of result.autoApproved) {
        if (!r.finalize) continue;
        const payload = {
          matchId: r.match.id,
          status: 'COMPLETED' as const,
          outcome: 'AUTO_APPROVED' as const,
          winner: toUserPublic(r.finalize.winner),
          loser: toUserPublic(r.finalize.loser),
          winnerDelta: r.finalize.winnerDelta,
          loserDelta: r.finalize.loserDelta,
        };
        teardownMatchChannel(prisma, r.match.id).catch((err) =>
          console.error('[discord] teardown failed', err),
        );
        notifyEvent(io, r.match.player1Id, 'match:ended', payload);
        notifyEvent(io, r.match.player2Id, 'match:ended', payload);
      }

      for (const m of result.drawn) {
        const payload = {
          matchId: m.id,
          status: 'DRAW' as const,
          outcome: 'TIMEOUT_DRAW' as const,
        };
        teardownMatchChannel(prisma, m.id).catch((err) =>
          console.error('[discord] teardown failed', err),
        );
        notifyEvent(io, m.player1Id, 'match:ended', payload);
        notifyEvent(io, m.player2Id, 'match:ended', payload);
      }
    } catch (err) {
      console.error('[matchTimeoutLoop] error:', err);
    }
  }, MATCH_TICK_INTERVAL_MS);
}
