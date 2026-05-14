import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchLeaderboard,
  fetchCurrentSeason,
  fetchMonthlyStats,
} from '../api/seasons';
import { useAuth } from '../hooks/useAuth';

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const now = new Date();

  const { data: season } = useQuery({
    queryKey: ['current-season'],
    queryFn: fetchCurrentSeason,
  });
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboard(50),
  });
  const { data: monthly } = useQuery({
    queryKey: ['monthly-stats', now.getUTCFullYear(), now.getUTCMonth() + 1],
    queryFn: () => fetchMonthlyStats(now.getUTCFullYear(), now.getUTCMonth() + 1),
  });

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">ランキング</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-arena-subtext hover:text-arena-text"
        >
          戻る
        </button>
      </header>

      {season && (
        <section className="bg-arena-surface border border-arena-border rounded-xl p-4 mb-6">
          <p className="text-arena-subtext text-xs mb-1">現在のシーズン</p>
          <h2 className="text-xl font-bold mb-1">{season.name}</h2>
          <p className="text-arena-subtext text-sm">
            {new Date(season.startAt).toLocaleDateString('ja-JP')} 〜{' '}
            {new Date(season.endAt).toLocaleDateString('ja-JP')}
          </p>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">レーティング上位</h2>
        {isLoading && <p className="text-arena-subtext">読み込み中...</p>}
        {leaderboard?.entries.length === 0 && (
          <p className="text-arena-subtext">対戦経験者がまだいません</p>
        )}
        <ol className="space-y-2">
          {leaderboard?.entries.map((e) => {
            const isMe = e.user.id === user?.id;
            return (
              <li
                key={e.user.id}
                className={
                  'flex items-center gap-3 rounded-xl p-3 border ' +
                  (isMe
                    ? 'bg-arena-accent/10 border-arena-accent'
                    : 'bg-arena-surface border-arena-border')
                }
              >
                <span className="w-8 text-center font-bold text-arena-subtext">
                  {e.rank}
                </span>
                <img
                  src={e.user.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full border border-arena-border"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {e.user.username}
                    {isMe && (
                      <span className="ml-2 text-xs text-arena-accent">あなた</span>
                    )}
                  </p>
                  <p className="text-arena-subtext text-xs">
                    {e.user.wins}勝 {e.user.losses}敗
                  </p>
                </div>
                <span className="font-bold text-lg tabular-nums">
                  {e.user.currentRating}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {monthly && monthly.topWinners.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3">今月の最多勝利者</h2>
          <ol className="space-y-2">
            {monthly.topWinners.map((w, i) => (
              <li
                key={w.user.id}
                className="flex items-center gap-3 bg-arena-surface border border-arena-border rounded-xl p-3"
              >
                <span className="w-8 text-center font-bold text-arena-subtext">
                  {i + 1}
                </span>
                <img
                  src={w.user.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full border border-arena-border"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{w.user.username}</p>
                </div>
                <span className="font-bold tabular-nums">{w.wins}勝</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default LeaderboardPage;
