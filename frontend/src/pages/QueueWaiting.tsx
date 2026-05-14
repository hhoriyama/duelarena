import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { computeRange, formatElapsed, TIMEOUT_MS } from '../lib/queue-formulas';
import type { UserPublic } from '../types/user';

interface MatchFoundPayload {
  matchId: string;
  opponent: UserPublic;
}

export function QueueWaitingPage() {
  const { socket, connected, error: socketError } = useSocket();
  const navigate = useNavigate();
  const [enteredAt, setEnteredAt] = useState<Date | null>(null);
  const [tickNow, setTickNow] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // 接続後にキューに入る
  useEffect(() => {
    if (!connected) return;
    socket.emit('queue:enter');

    function onEntered(data: { enteredAt: string }) {
      setEnteredAt(new Date(data.enteredAt));
      setError(null);
    }
    function onMatchFound(payload: MatchFoundPayload) {
      // 次フェーズで実装するマッチ成立画面へ
      navigate(`/match/${payload.matchId}`, {
        state: { opponent: payload.opponent },
      });
    }
    function onTimeout() {
      setTimedOut(true);
      setEnteredAt(null);
    }
    function onError(payload: { message: string }) {
      setError(payload.message);
    }

    socket.on('queue:entered', onEntered);
    socket.on('match:found', onMatchFound);
    socket.on('queue:timeout', onTimeout);
    socket.on('queue:error', onError);

    return () => {
      socket.off('queue:entered', onEntered);
      socket.off('match:found', onMatchFound);
      socket.off('queue:timeout', onTimeout);
      socket.off('queue:error', onError);
    };
  }, [connected, socket, navigate]);

  // 待機時間タイマー（1秒ごと更新）
  useEffect(() => {
    if (!enteredAt) return;
    const id = setInterval(() => setTickNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [enteredAt]);

  function handleCancel() {
    socket.emit('queue:leave');
    navigate('/');
  }

  // ソケット接続エラー
  if (socketError) {
    return <Centered>{socketError}</Centered>;
  }

  if (!connected) {
    return <Centered>サーバーに接続中...</Centered>;
  }

  if (error) {
    return (
      <Centered>
        <p className="text-arena-accent mb-4">エラー: {error}</p>
        <BackButton onClick={() => navigate('/')} />
      </Centered>
    );
  }

  if (timedOut) {
    return (
      <Centered>
        <h2 className="text-2xl font-bold mb-2">マッチング失敗</h2>
        <p className="text-arena-subtext mb-6">
          5分以内に対戦相手が見つかりませんでした。
        </p>
        <BackButton onClick={() => navigate('/')} />
      </Centered>
    );
  }

  if (!enteredAt) {
    return <Centered>キューに入っています...</Centered>;
  }

  const elapsedMs = tickNow.getTime() - enteredAt.getTime();
  const remainingMs = Math.max(0, TIMEOUT_MS - elapsedMs);
  const range = computeRange(enteredAt, tickNow);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <h2 className="text-2xl font-bold mb-2">対戦相手を探しています</h2>
        <p className="text-arena-subtext mb-8">
          条件に合う相手が見つかったら自動で通知されます。
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Stat label="待機時間" value={formatElapsed(elapsedMs)} />
          <Stat label="残り時間" value={formatElapsed(remainingMs)} />
          <Stat label="許容レート差" value={`±${range}`} />
          <Stat label="状態" value="待機中" />
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="w-full bg-arena-border hover:bg-arena-accent hover:text-white text-arena-text font-semibold py-3 rounded-xl transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-arena-bg border border-arena-border rounded-xl p-4 text-center">
      <p className="text-arena-subtext text-xs mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-8 max-w-md w-full">
        {children}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-arena-accent hover:bg-arena-accentHover text-white font-semibold px-6 py-3 rounded-lg"
    >
      ダッシュボードへ戻る
    </button>
  );
}

export default QueueWaitingPage;
