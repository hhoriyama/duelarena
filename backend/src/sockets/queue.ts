import type { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import { enterQueue, leaveQueue, tick, getQueueState } from '../services/matchmaking';
import { toUserPublic } from '../services/user-service';
import { setupMatchChannel } from '../discord/voice-channel-service';
import { globalTracker } from './connection-tracker';

const TICK_INTERVAL_MS = 15_000;

/**
 * 1ユーザーあたりのソケットイベントハンドラ
 */
export function registerQueueHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  socket.on('queue:enter', async () => {
    try {
      const result = await enterQueue(prisma, userId, socket.id);

      if (result.matched) {
        // Discord VC を非同期で作成（失敗してもマッチ自体は通知する）
        setupMatchChannel(
          prisma,
          result.match.id,
          result.self.discordId,
          result.opponent.discordId,
        ).catch((err) => console.error('[discord] setup failed', err));

        // 両者に通知
        notifyMatchFound(io, result.match.id, result.self.id, result.opponent);
        notifyMatchFound(io, result.match.id, result.opponent.id, result.self);
      } else {
        socket.emit('queue:entered', {
          enteredAt: result.enteredAt.toISOString(),
          ratingAtEntry: result.ratingAtEntry,
        });
      }
    } catch (err) {
      socket.emit('queue:error', {
        message: (err as Error).message,
      });
    }
  });

  socket.on('queue:leave', async () => {
    try {
      await leaveQueue(prisma, userId);
      socket.emit('queue:left', {});
    } catch (err) {
      socket.emit('queue:error', {
        message: (err as Error).message,
      });
    }
  });

  socket.on('queue:status', async () => {
    try {
      const state = await getQueueState(prisma, userId);
      socket.emit('queue:status', {
        ...state,
        enteredAt: state.enteredAt?.toISOString() ?? null,
      });
    } catch (err) {
      socket.emit('queue:error', {
        message: (err as Error).message,
      });
    }
  });
}

/**
 * 1ユーザーにマッチ成立を通知する
 */
function notifyMatchFound(
  io: Server,
  matchId: string,
  notifyUserId: string,
  opponent: import('@prisma/client').User,
): void {
  const socketId = globalTracker.getSocketId(notifyUserId);
  if (!socketId) return;
  io.to(socketId).emit('match:found', {
    matchId,
    opponent: toUserPublic(opponent),
  });
}

/**
 * 定期 tick：タイムアウトとマッチング再試行
 */
export function startTickLoop(io: Server): void {
  setInterval(async () => {
    try {
      const result = await tick(prisma);

      // タイムアウト通知
      for (const userId of result.timedOutUserIds) {
        const sid = globalTracker.getSocketId(userId);
        if (sid) {
          io.to(sid).emit('queue:timeout', {});
        }
      }

      // 新規マッチ通知
      for (const m of result.matches) {
        // Discord VC 作成（非同期）
        setupMatchChannel(
          prisma,
          m.match.id,
          m.player1.discordId,
          m.player2.discordId,
        ).catch((err) => console.error('[discord] setup failed', err));

        notifyMatchFound(io, m.match.id, m.player1.id, m.player2);
        notifyMatchFound(io, m.match.id, m.player2.id, m.player1);
      }
    } catch (err) {
      console.error('[tick] error:', err);
    }
  }, TICK_INTERVAL_MS);
}
