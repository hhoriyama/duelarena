import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/authStore';
import { logout } from '../api/auth';
import { disconnectSocket } from '../lib/socket';
import { fetchActiveMatch } from '../api/matches';

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 進行中の試合があれば自動的に試合画面に戻す
  const { data: activeMatch } = useQuery({
    queryKey: ['active-match'],
    queryFn: fetchActiveMatch,
  });

  useEffect(() => {
    if (activeMatch?.matchId) {
      navigate(`/match/${activeMatch.matchId}`, { replace: true });
    }
  }, [activeMatch, navigate]);

  if (!user) return null;

  const winRate =
    user.wins + user.losses > 0
      ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
      : '-';

  async function handleLogout() {
    await logout();
    clearAuth();
    queryClient.removeQueries({ queryKey: ['me'] });
    disconnectSocket();
    navigate('/login');
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">デュエルアリーナ</h1>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="bg-arena-accent hover:bg-arena-accentHover text-white text-xs font-semibold px-3 py-1 rounded"
            >
              管理画面
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-arena-subtext hover:text-arena-text"
          >
            ログアウト
          </button>
        </div>
      </header>

      <section className="bg-arena-surface border border-arena-border rounded-2xl p-6 md:p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={user.avatarUrl}
            alt=""
            className="w-16 h-16 rounded-full border-2 border-arena-border"
          />
          <div>
            <h2 className="text-xl font-bold">{user.username}</h2>
            <p className="text-arena-subtext text-sm">Discord ID: {user.discordId}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="現在レート" value={user.currentRating} />
          <Stat label="最高レート" value={user.highestRating} />
          <Stat label="勝敗" value={`${user.wins} / ${user.losses}`} />
          <Stat label="勝率" value={`${winRate}%`} />
        </div>
      </section>

      <section className="bg-arena-surface border border-arena-border rounded-2xl p-6 md:p-8 mb-4">
        <button
          type="button"
          onClick={() => navigate('/queue')}
          className="w-full bg-arena-accent hover:bg-arena-accentHover text-white font-bold py-4 rounded-xl text-lg transition-colors"
        >
          対戦相手を見つける
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="bg-arena-surface hover:bg-arena-border border border-arena-border text-arena-text font-semibold py-3 rounded-xl transition-colors"
        >
          試合履歴
        </button>
        <button
          type="button"
          onClick={() => navigate('/leaderboard')}
          className="bg-arena-surface hover:bg-arena-border border border-arena-border text-arena-text font-semibold py-3 rounded-xl transition-colors"
        >
          ランキング
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-arena-bg border border-arena-border rounded-xl p-4 text-center">
      <p className="text-arena-subtext text-xs mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

export default DashboardPage;
