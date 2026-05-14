import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * シングルトンの Socket.IO クライアントを取得する。
 * Cookie 認証で接続する。
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

/**
 * ソケットを切断してクリアする
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type { Socket };
