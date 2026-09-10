import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../api';

/* ========== 型（Backend /api/admin/* のレスポンスに対応） ========== */

interface DashboardStats {
  totalUsers: number;
  bannedUsers: number;
  activeUsers: number;
  matchesInProgress: number;
  matchesWaitingApproval: number;
  matchesDisputed: number;
  queueSize: number;
  matchesToday: number;
}

interface AdminUser {
  id: string;
  discordId: string;
  username: string;
  currentRating: number;
  wins: number;
  losses: number;
  isBanned: boolean;
}

interface DisputeItem {
  id: string;
  matchId: string;
  description: string;
  createdAt: string;
  player1: { id: string; username: string; currentRating: number };
  player2: { id: string; username: string; currentRating: number };
  reports: Array<{ reporterId: string; reportedWinnerId: string }>;
}

/* ========== メイン ========== */

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getJson<{ admin: boolean }>('/api/admin-auth/me')
      .then((d) => setAuthed(d.admin))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <p className="muted">確認中…</p>;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;
  return <AdminPanel onLogout={() => setAuthed(false)} />;
}

/* ========== ログイン ========== */

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await postJson('/api/admin-auth/login', { password });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 360, margin: '60px auto' }}>
      <h2>管理者ログイン</h2>
      <form onSubmit={submit}>
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={busy || !password}>
            ログイン
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}

/* ========== 管理パネル本体 ========== */

type Tab = 'stats' | 'disputes' | 'users' | 'event';

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('stats');

  async function logout() {
    await postJson('/api/admin-auth/logout').catch(() => undefined);
    onLogout();
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <div className="tabs">
          <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
            統計
          </button>
          <button className={tab === 'disputes' ? 'active' : ''} onClick={() => setTab('disputes')}>
            異議の裁定
          </button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            ユーザー管理
          </button>
          <button className={tab === 'event' ? 'active' : ''} onClick={() => setTab('event')}>
            イベント抽選
          </button>
        </div>
        <button className="secondary" onClick={logout}>
          ログアウト
        </button>
      </div>
      {tab === 'stats' ? <StatsTab /> : null}
      {tab === 'disputes' ? <DisputesTab /> : null}
      {tab === 'users' ? <UsersTab /> : null}
      {tab === 'event' ? <EventDrawTab /> : null}
    </>
  );
}

/* ========== イベント抽選 ========== */

interface DrawEntry {
  username: string;
  wins: number;
  losses: number;
}

interface DrawResult {
  minWins: number;
  maxWins: number;
  topWinners: DrawEntry[];
  candidates: DrawEntry[];
  picked: DrawEntry | null;
}

function EventDrawTab() {
  const [minWins, setMinWins] = useState('3');
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function draw() {
    setBusy(true);
    setError('');
    try {
      const d = await getJson<DrawResult>(
        `/api/admin/event/draw?minWins=${encodeURIComponent(minWins)}`,
      );
      setResult(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>🎁 プレゼント抽選</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          最多勝利者（同数なら全員）が確定枠、規定勝利数以上の人（最多勝利者を除く）から
          ランダムで1名を選びます。押すたびに引き直されるので、確定したら記録してください。
        </p>
        <div className="row">
          <span>規定勝利数</span>
          <input
            type="number"
            min={1}
            value={minWins}
            onChange={(e) => setMinWins(e.target.value)}
            style={{ width: 90 }}
          />
          <button onClick={draw} disabled={busy}>
            抽選する
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </div>

      {result ? (
        <>
          <div className="card">
            <h2>🏆 最多勝利（{result.maxWins}勝）</h2>
            {result.topWinners.length === 0 ? (
              <p className="muted">対象者がいません（イベントの勝利記録なし）。</p>
            ) : (
              result.topWinners.map((w) => (
                <p key={w.username} style={{ margin: '4px 0' }}>
                  <strong>{w.username}</strong>{' '}
                  <span className="muted">
                    （{w.wins}勝{w.losses}敗）
                  </span>
                </p>
              ))
            )}
          </div>
          <div className="card">
            <h2>🎲 ランダム当選（{result.minWins}勝以上・対象 {result.candidates.length}名）</h2>
            {result.picked ? (
              <p style={{ fontSize: 20 }}>
                <strong>{result.picked.username}</strong>{' '}
                <span className="muted">
                  （{result.picked.wins}勝{result.picked.losses}敗）
                </span>
              </p>
            ) : (
              <p className="muted">条件を満たす対象者がいません。</p>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

/* ========== 統計 ========== */

function StatsTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson<DashboardStats>('/api/admin/dashboard')
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">読み込み中…</p>;

  const items: Array<[string, number]> = [
    ['登録ユーザー', stats.totalUsers],
    ['アクティブ', stats.activeUsers],
    ['BAN中', stats.bannedUsers],
    ['キュー待機', stats.queueSize],
    ['進行中の試合', stats.matchesInProgress],
    ['承認待ち', stats.matchesWaitingApproval],
    ['異議あり', stats.matchesDisputed],
    ['今日の試合', stats.matchesToday],
  ];

  return (
    <div className="stats-grid">
      {items.map(([label, value]) => (
        <div className="stat" key={label}>
          <div className="label">{label}</div>
          <div className="value">{value}</div>
        </div>
      ))}
    </div>
  );
}

/* ========== 異議の裁定 ========== */

function DisputesTab() {
  const [disputes, setDisputes] = useState<DisputeItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getJson<{ disputes: DisputeItem[] }>('/api/admin/disputes')
      .then((d) => setDisputes(d.disputes))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function resolve(d: DisputeItem, resolution: { winnerId: string } | { cancel: true }) {
    const label =
      'cancel' in resolution
        ? 'この試合を無効（レート変動なし）にします。'
        : `勝者を「${
            resolution.winnerId === d.player1.id ? d.player1.username : d.player2.username
          }」として確定します。`;
    if (!window.confirm(`${label}\nよろしいですか？`)) return;
    try {
      await postJson(`/api/admin/disputes/${d.id}/resolve`, resolution);
      load();
    } catch (err) {
      alert(`失敗しました: ${(err as Error).message}`);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!disputes) return <p className="muted">読み込み中…</p>;
  if (disputes.length === 0) return <p className="muted">未裁定の異議はありません 🎉</p>;

  return (
    <>
      {disputes.map((d) => (
        <div className="card" key={d.id}>
          <div>
            <strong>{d.player1.username}</strong>
            <span className="muted"> (レート {d.player1.currentRating}) vs </span>
            <strong>{d.player2.username}</strong>
            <span className="muted"> (レート {d.player2.currentRating})</span>
          </div>
          <p className="muted" style={{ margin: '4px 0' }}>
            {new Date(d.createdAt).toLocaleString('ja-JP')} — {d.description}
          </p>
          <div>
            {d.reports.map((r, i) => {
              const reporter =
                r.reporterId === d.player1.id ? d.player1.username : d.player2.username;
              const claimed =
                r.reportedWinnerId === d.player1.id ? d.player1.username : d.player2.username;
              return (
                <p key={i} style={{ margin: '2px 0' }}>
                  📝 {reporter} の報告: <strong>{claimed} の勝ち</strong>
                </p>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="success" onClick={() => resolve(d, { winnerId: d.player1.id })}>
              {d.player1.username} の勝ち
            </button>
            <button className="success" onClick={() => resolve(d, { winnerId: d.player2.id })}>
              {d.player2.username} の勝ち
            </button>
            <button className="danger" onClick={() => resolve(d, { cancel: true })}>
              試合を無効化
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ========== ユーザー管理 ========== */

function UsersTab() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    try {
      const d = await getJson<{ users: AdminUser[] }>(
        `/api/admin/users/search?q=${encodeURIComponent(query)}`,
      );
      setUsers(d.users);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function ban(u: AdminUser) {
    const reason = window.prompt(`「${u.username}」をBANします。理由を入力してください:`);
    if (!reason) return;
    try {
      await postJson(`/api/admin/users/${u.id}/ban`, { reason });
      search();
    } catch (err) {
      alert(`失敗しました: ${(err as Error).message}`);
    }
  }

  async function unban(u: AdminUser) {
    if (!window.confirm(`「${u.username}」のBANを解除しますか？`)) return;
    try {
      await postJson(`/api/admin/users/${u.id}/unban`);
      search();
    } catch (err) {
      alert(`失敗しました: ${(err as Error).message}`);
    }
  }

  async function adjust(u: AdminUser) {
    const input = window.prompt(
      `「${u.username}」の新しいレートを入力してください（現在: ${u.currentRating}）:`,
    );
    if (!input) return;
    const rating = Number(input);
    if (!Number.isInteger(rating) || rating < 0) {
      alert('0以上の整数で入力してください');
      return;
    }
    const reason = window.prompt('調整理由:') ?? '(理由未入力)';
    try {
      await postJson(`/api/admin/users/${u.id}/adjust-rating`, { rating, reason });
      search();
    } catch (err) {
      alert(`失敗しました: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <form className="row" onSubmit={search} style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="ユーザー名 または Discord ID で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={!query.trim()}>
          検索
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {users.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>ユーザー</th>
              <th className="num">レート</th>
              <th className="num">勝敗</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td className="num">{u.currentRating}</td>
                <td className="num">
                  {u.wins}勝{u.losses}敗
                </td>
                <td>{u.isBanned ? <span className="error">BAN中</span> : '通常'}</td>
                <td>
                  <div className="row">
                    <button className="secondary" onClick={() => adjust(u)}>
                      レート調整
                    </button>
                    {u.isBanned ? (
                      <button className="secondary" onClick={() => unban(u)}>
                        BAN解除
                      </button>
                    ) : (
                      <button className="danger" onClick={() => ban(u)}>
                        BAN
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
