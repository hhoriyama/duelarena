import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { UserPublic } from '../types/user';

interface LocationState {
  opponent?: UserPublic;
}

/**
 * 第2-A段階のプレースホルダー。次の段階（2-B）でトス＆対戦UIに置き換える。
 */
export function MatchPlaceholderPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const opponent = (location.state as LocationState | null)?.opponent;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <h2 className="text-2xl font-bold mb-2">⚔️ マッチ成立！</h2>
        <p className="text-arena-subtext text-xs mb-6">Match ID: {matchId}</p>

        {opponent ? (
          <div className="flex items-center justify-center gap-4 mb-6">
            <img
              src={opponent.avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full border-2 border-arena-border"
            />
            <div className="text-left">
              <p className="font-bold text-lg">{opponent.username}</p>
              <p className="text-arena-subtext text-sm">レート: {opponent.currentRating}</p>
              <p className="text-arena-subtext text-sm">
                戦績: {opponent.wins}勝 {opponent.losses}敗
              </p>
            </div>
          </div>
        ) : (
          <p className="text-arena-subtext mb-6">対戦相手の情報が取得できませんでした。</p>
        )}

        <p className="text-arena-subtext text-sm mb-6">
          次の段階（第2-B）でトス機能と対戦フローを実装します。
        </p>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full bg-arena-accent hover:bg-arena-accentHover text-white font-semibold py-3 rounded-xl transition-colors"
        >
          ダッシュボードへ戻る
        </button>
      </div>
    </div>
  );
}

export default MatchPlaceholderPage;
