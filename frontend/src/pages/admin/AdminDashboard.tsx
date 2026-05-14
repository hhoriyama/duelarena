import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminDashboard } from '../../api/admin';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdminDashboard,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">管理ダッシュボード</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-arena-subtext hover:text-arena-text"
        >
          戻る
        </button>
      </header>

      <nav className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <NavBtn label="紛争裁定" onClick={() => navigate('/admin/disputes')} />
        <NavBtn label="ユーザー管理" onClick={() => navigate('/admin/users')} />
      </nav>

      {isLoading && <p className="text-arena-subtext">読み込み中...</p>}
      {error && <p className="text-arena-accent">読み込みに失敗しました</p>}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatBox label="登録ユーザー" value={data.totalUsers} />
          <StatBox label="アクティブ" value={data.activeUsers} />
          <StatBox label="BAN中" value={data.bannedUsers} accent={data.bannedUsers > 0} />
          <StatBox label="キュー待機" value={data.queueSize} />
          <StatBox
            label="紛争中"
            value={data.matchesDisputed}
            accent={data.matchesDisputed > 0}
          />
          <StatBox label="マッチ準備中" value={data.matchesPendingToss} />
          <StatBox label="対戦中" value={data.matchesInProgress} />
          <StatBox label="承認待ち" value={data.matchesWaitingApproval} />
          <StatBox label="本日の試合" value={data.matchesToday} />
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        'rounded-xl p-4 border ' +
        (accent
          ? 'bg-arena-accent/10 border-arena-accent'
          : 'bg-arena-surface border-arena-border')
      }
    >
      <p className="text-arena-subtext text-xs mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-arena-accent hover:bg-arena-accentHover text-white font-bold py-3 rounded-xl"
    >
      {label}
    </button>
  );
}

export default AdminDashboardPage;
