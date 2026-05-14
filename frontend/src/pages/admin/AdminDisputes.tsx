import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOpenDisputes,
  resolveDispute,
  type DisputeListItem,
} from '../../api/admin';
import { useState } from 'react';

export function AdminDisputesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: fetchOpenDisputes,
  });

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">紛争裁定</h1>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="text-sm text-arena-subtext hover:text-arena-text"
        >
          戻る
        </button>
      </header>

      {isLoading && <p className="text-arena-subtext">読み込み中...</p>}
      {data?.disputes.length === 0 && (
        <p className="text-arena-subtext text-center py-8">
          現在オープン中の紛争はありません
        </p>
      )}
      <ul className="space-y-4">
        {data?.disputes.map((d) => (
          <DisputeCard key={d.id} dispute={d} />
        ))}
      </ul>
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: DisputeListItem }) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(resolution: { winnerId: string } | { cancel: true }) {
    setError(null);
    setSubmitting(true);
    try {
      await resolveDispute(dispute.id, resolution);
      await queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="bg-arena-surface border border-arena-border rounded-2xl p-5">
      <div className="flex items-center gap-4 mb-3">
        <PlayerCard label="プレイヤー1" name={dispute.player1.username} />
        <span className="text-arena-subtext">vs</span>
        <PlayerCard label="プレイヤー2" name={dispute.player2.username} />
      </div>

      <div className="bg-arena-bg border border-arena-border rounded-xl p-3 mb-3 text-sm">
        <p className="text-arena-subtext text-xs mb-1">通報内容</p>
        <p className="whitespace-pre-wrap">{dispute.description}</p>
      </div>

      {dispute.evidenceUrls.length > 0 && (
        <div className="bg-arena-bg border border-arena-border rounded-xl p-3 mb-3 text-sm">
          <p className="text-arena-subtext text-xs mb-1">エビデンス</p>
          <ul className="space-y-1">
            {dispute.evidenceUrls.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dispute.reports.length > 0 && (
        <div className="bg-arena-bg border border-arena-border rounded-xl p-3 mb-4 text-sm">
          <p className="text-arena-subtext text-xs mb-1">プレイヤー報告内容</p>
          {dispute.reports.map((r, i) => {
            const reporter =
              r.reporterId === dispute.player1.id ? dispute.player1 : dispute.player2;
            const winner =
              r.reportedWinnerId === dispute.player1.id
                ? dispute.player1
                : dispute.player2;
            return (
              <p key={i}>
                <span className="font-semibold">{reporter.username}</span> が「
                <span className="font-semibold">{winner.username}</span> の勝利」と報告
              </p>
            );
          })}
        </div>
      )}

      <p className="text-arena-subtext text-xs mb-2">この試合の勝者として確定する：</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => resolve({ winnerId: dispute.player1.id })}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-arena-border text-white font-semibold py-2 rounded"
        >
          {dispute.player1.username} の勝利
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => resolve({ winnerId: dispute.player2.id })}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-arena-border text-white font-semibold py-2 rounded"
        >
          {dispute.player2.username} の勝利
        </button>
      </div>
      <button
        type="button"
        disabled={submitting}
        onClick={() => resolve({ cancel: true })}
        className="w-full bg-arena-border hover:bg-arena-border/80 disabled:opacity-50 text-arena-text font-semibold py-2 rounded text-sm"
      >
        試合を無効化（レート変動なし）
      </button>
      {error && <p className="text-arena-accent text-sm mt-2">{error}</p>}
    </li>
  );
}

function PlayerCard({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex-1">
      <p className="text-arena-subtext text-xs">{label}</p>
      <p className="font-semibold truncate">{name}</p>
    </div>
  );
}

export default AdminDisputesPage;
