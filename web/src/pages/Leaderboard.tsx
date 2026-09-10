import { useEffect, useState } from 'react';
import { getJson } from '../api';

interface Entry {
  rank: number;
  username: string;
  avatarUrl: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  matchCount: number;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson<{ users: Entry[] }>('/api/public/leaderboard')
      .then((d) => setEntries(d.users))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">読み込みに失敗しました: {error}</p>;
  if (!entries) return <p className="muted">読み込み中…</p>;
  if (entries.length === 0) return <p className="muted">まだ試合をしたプレイヤーがいません。</p>;

  return (
    <>
      <h1>ランキング</h1>
      <table>
        <thead>
          <tr>
            <th className="num">#</th>
            <th>プレイヤー</th>
            <th className="num">レート</th>
            <th className="num">勝</th>
            <th className="num">敗</th>
            <th className="num">分</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((u) => (
            <tr key={u.rank}>
              <td className={`num rank-${u.rank <= 3 ? u.rank : ''}`}>{u.rank}</td>
              <td>
                {u.avatarUrl ? <img className="avatar" src={u.avatarUrl} alt="" /> : null}
                {u.username}
              </td>
              <td className="num">
                <strong>{u.rating}</strong>
              </td>
              <td className="num">{u.wins}</td>
              <td className="num">{u.losses}</td>
              <td className="num">{u.draws}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
