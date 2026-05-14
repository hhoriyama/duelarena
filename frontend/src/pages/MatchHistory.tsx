import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMatchHistory, type HistoryItem } from '../api/matches';
import {
  formatDate,
  formatDelta,
  resultColorClass,
  resultLabel,
} from '../lib/match-formulas';

export function MatchHistoryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['match-history'],
    queryFn: () => fetchMatchHistory(50),
  });

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">試合履歴</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-arena-subtext hover:text-arena-text"
        >
          戻る
        </button>
      </header>

      {isLoading && <p className="text-arena-subtext">読み込み中...</p>}
      {error && <p className="text-arena-accent">読み込みに失敗しました</p>}
      {data && data.matches.length === 0 && (
        <p className="text-arena-subtext text-center py-8">
          まだ試合履歴がありません
        </p>
      )}
      {data && data.matches.length > 0 && (
        <ul className="space-y-2">
          {data.matches.map((m) => (
            <HistoryRow key={m.id} item={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <li className="bg-arena-surface border border-arena-border rounded-xl p-4 flex items-center gap-4">
      <img
        src={item.opponent.avatarUrl}
        alt=""
        className="w-12 h-12 rounded-full border border-arena-border"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{item.opponent.username}</p>
        <p className="text-arena-subtext text-xs">{formatDate(item.endedAt)}</p>
      </div>
      <div className="text-right">
        <p className={'font-bold ' + resultColorClass(item.result)}>
          {resultLabel(item.result)}
        </p>
        <p
          className={
            'text-sm tabular-nums ' +
            (item.myRatingDelta > 0
              ? 'text-emerald-400'
              : item.myRatingDelta < 0
                ? 'text-rose-400'
                : 'text-arena-subtext')
          }
        >
          {formatDelta(item.myRatingDelta)}
        </p>
      </div>
    </li>
  );
}

export default MatchHistoryPage;
