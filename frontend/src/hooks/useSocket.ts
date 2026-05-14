import { useEffect, useState } from 'react';
import { getSocket, type Socket } from '../lib/socket';

interface SocketHookResult {
  socket: Socket;
  connected: boolean;
  error: string | null;
}

/**
 * Socket.IO のシングルトンクライアントを取得し、接続状態を購読するフック
 */
export function useSocket(): SocketHookResult {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();
    function onConnect() {
      setConnected(true);
      setError(null);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onConnectError(err: Error) {
      setError(err.message);
    }
    function onDuplicateTab() {
      setError('別のタブで既に接続中です');
    }
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.on('error:duplicate-tab', onDuplicateTab);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off('error:duplicate-tab', onDuplicateTab);
    };
  }, []);

  return { socket, connected, error };
}
