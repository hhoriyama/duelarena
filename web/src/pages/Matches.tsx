import { useEffect, useState } from 'react';
import { getJson } from '../api';

interface PlayerCell {
  username: string;
  avatarUrl: string;
  delta: number | null;
}

interface MatchRow {
  id: string;
  endedAt: string | null;
  status: string;
  player1: PlayerCell;
  player2: PlayerCell;
  winner: 'player1' | 'player2' | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

function fmtDelta(delta: number | null): string {
  if (delta === null) return '';
  return delta >= 0 ? ` (+${delta})` : ` (${delta})`;
}

function Player({ p, isWinner, decided }: { p: PlayerCell; isWinner: boolean; decided: boolean }) {
  return (
    <span className={isWinner ? 'win' : decided ? 'lose' : ''}>
      {isWinner ? '🏆 ' : ''}
      {p.username}
      <span className="delta muted">{fmtDelta(p.delta)}</span>
    </span>
  );
}

export default function Matches() {
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson<{ matches: MatchRow[] }>('/api/public/matches')
      .then((d) => setMatches(d.matches))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">読み込みに失敗しました: {error}</p>;
  if (!matches) return <p className="muted">読み込み中…</p>;
  if (matches.length === 0) return <p className="muted">まだ確定した試合がありません。</p>;

  return (
    <>
      <h1>試合履歴</h1>
      <table>
        <thead>
          <tr>
            <th>日時</th>
            <th>対戦</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id}>
              <td className="muted">{fmtDate(m.endedAt)}</td>
              <td>
                <Player p={m.player1} isWinner={m.winner === 'player1'} decided={m.winner !== null} />
                <span className="muted"> vs </span>
                <Player p={m.player2} isWinner={m.winner === 'player2'} decided={m.winner !== null} />
                {m.status === 'DRAW' ? <span className="muted">（引き分け）</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
