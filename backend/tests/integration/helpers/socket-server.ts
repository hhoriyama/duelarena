import { createServer, Server as HttpServer } from 'http';
import type { Server as SocketServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../../src/app';
import { attachSocketServer } from '../../../src/sockets';
import { globalTracker } from '../../../src/sockets/connection-tracker';
import { signJwt } from '../../../src/lib/jwt';

let httpServer: HttpServer | null = null;
let socketServer: SocketServer | null = null;
let baseUrl = '';

/**
 * テスト用にSocket.IOサーバーを動的ポートで起動
 */
export async function startTestServer(): Promise<{ url: string }> {
  const app = createApp();
  httpServer = createServer(app);
  socketServer = attachSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer!.listen(0, () => {
      const addr = httpServer!.address();
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });

  return { url: baseUrl };
}

export async function stopTestServer(): Promise<void> {
  // ConnectionTrackerをクリア
  for (const sid of Array.from(['__cleanup__'])) {
    globalTracker.unregister(sid);
  }
  if (socketServer) {
    await new Promise<void>((resolve) => socketServer!.close(() => resolve()));
  }
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
  }
  httpServer = null;
  socketServer = null;
}

/**
 * 認証付きクライアントソケットを作成
 */
export function connectClient(opts: {
  userId: string;
  discordId: string;
  isAdmin?: boolean;
}): Promise<ClientSocket> {
  const token = signJwt({
    userId: opts.userId,
    discordId: opts.discordId,
    isAdmin: opts.isAdmin ?? false,
  });
  const socket = ioClient(baseUrl, {
    transports: ['websocket'],
    extraHeaders: {
      Cookie: `duel_arena_token=${token}`,
    },
    forceNew: true,
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

/**
 * イベントを単発受信するためのヘルパー
 */
export function waitFor<T = unknown>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}
