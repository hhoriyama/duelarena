import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyJwt } from '../lib/jwt';
import { TOKEN_COOKIE_NAME } from '../middleware/auth';
import { globalTracker } from './connection-tracker';
import { registerQueueHandlers, startTickLoop } from './queue';
import { registerMatchHandlers, startMatchTimeoutLoop } from './match';
import { prisma } from '../lib/prisma';

/**
 * Cookie ヘッダから値を取り出す簡易パーサ
 */
function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

declare module 'socket.io' {
  interface Socket {
    data: {
      userId: string;
      discordId: string;
      isAdmin: boolean;
    };
  }
}

export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  // 認証ミドルウェア
  io.use((socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.request.headers.cookie);
      const token = cookies[TOKEN_COOKIE_NAME];
      if (!token) return next(new Error('Unauthorized'));
      const payload = verifyJwt(token);
      if (!payload) return next(new Error('Invalid token'));
      socket.data = {
        userId: payload.userId,
        discordId: payload.discordId,
        isAdmin: payload.isAdmin,
      };
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;

    // 複数タブブロック
    const ok = globalTracker.register(userId, socket.id);
    if (!ok) {
      socket.emit('error:duplicate-tab', {
        message: '別のタブで既に接続中です',
      });
      socket.disconnect();
      return;
    }

    console.log(`[socket] connected user=${userId} socket=${socket.id}`);

    // ハンドラ登録
    registerQueueHandlers(io, socket);
    registerMatchHandlers(io, socket);

    socket.on('disconnect', async () => {
      const removed = globalTracker.unregister(socket.id);
      console.log(`[socket] disconnected user=${removed} socket=${socket.id}`);
      // 切断時にキューから除去
      if (removed) {
        await prisma.queueEntry.deleteMany({ where: { userId: removed } });
      }
    });
  });

  // 定期 tick（タイムアウト & 再マッチ）
  startTickLoop(io);
  // 試合タイムアウト（自動承認 / 引き分け）
  startMatchTimeoutLoop(io);

  return io;
}
