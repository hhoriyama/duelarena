import { useEffect, useState } from 'react';
import { getJson } from '../api';

interface Standing {
  rank: number;
  username: string;
  avatarUrl: string;
  wins: number;
  losses: number;
}

interface EventData {
  open: boolean;
  openedAt: string | null;
  standings: Standing[];
}

export default function Event() {
  const [data, setData] = useState<EventData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson<EventData>('/api/public/event')
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">読み込みに失敗しました: {error}</p>;
  if (!data) return <p className="muted">読み込み中…</p>;

  return (
    <>
      <h1>
        🎪 イベント{' '}
        {data.open ? (
          <span className="win" style={{ fontSize: 14 }}>
            ● 開催中
          </span>
        ) : (
          <span className="muted" style={{ fontSize: 14 }}>
            ○ 終了
          </span>
        )}
      </h1>
      {data.openedAt ? (
        <p className="muted">
          集計期間: {new Date(data.openedAt).toLocaleString('ja-JP')} 〜
          （レート変動なしのイベント戦の勝敗を集計）
        </p>
      ) : null}
      {data.standings.length === 0 ? (
        <p className="muted">まだイベントの対戦結果がありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>プレイヤー</th>
              <th className="num">勝利数</th>
              <th className="num">敗北</th>
            </tr>
          </thead>
          <tbody>
            {data.standings.map((s) => (
              <tr key={s.rank}>
                <td className={`num rank-${s.rank <= 3 ? s.rank : ''}`}>{s.rank}</td>
                <td>
                  {s.avatarUrl ? <img className="avatar" src={s.avatarUrl} alt="" /> : null}
                  {s.username}
                </td>
                <td className="num">
                  <strong>{s.wins}</strong>
                </td>
                <td className="num">{s.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
