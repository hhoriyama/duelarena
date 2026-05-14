import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { fetchMatch, type MatchDetail, type MatchReportEntry } from '../api/matches';
import { rateOpponent } from '../api/reviews';
import { formatDelta } from '../lib/match-formulas';
import { StarRatingInput } from '../components/StarRatingInput';
import { ReportDialog } from '../components/ReportDialog';
import type { UserPublic } from '../types/user';

interface MatchEndedPayload {
  matchId: string;
  status: 'COMPLETED' | 'DRAW';
  outcome: 'TOSSED' | 'APPROVED' | 'AUTO_APPROVED' | 'TIMEOUT_DRAW';
  tossById?: string;
  tosserDelta?: number;
  receiverDelta?: number;
  winner?: UserPublic;
  loser?: UserPublic;
  winnerDelta?: number;
  loserDelta?: number;
}

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => fetchMatch(matchId!),
    enabled: !!matchId,
  });

  const [endedPayload, setEndedPayload] = useState<MatchEndedPayload | null>(null);

  // ソケットイベント購読
  useEffect(() => {
    if (!matchId || !connected) return;

    function onUpdated(payload: { matchId: string }) {
      if (payload.matchId !== matchId) return;
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    }
    function onEnded(payload: MatchEndedPayload) {
      if (payload.matchId !== matchId) return;
      setEndedPayload(payload);
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    }

    socket.on('match:updated', onUpdated);
    socket.on('match:ended', onEnded);

    return () => {
      socket.off('match:updated', onUpdated);
      socket.off('match:ended', onEnded);
    };
  }, [matchId, connected, socket, queryClient]);

  if (isLoading) return <Centered>読み込み中...</Centered>;
  if (error || !data) {
    return (
      <Centered>
        <p className="text-arena-accent mb-4">試合が見つかりませんでした</p>
        <BackButton onClick={() => navigate('/')} />
      </Centered>
    );
  }

  const match = data.match;
  const opponent = match.player1.id === user?.id ? match.player2 : match.player1;

  // 終了済みの状態 or 終了通知が来た場合
  if (endedPayload || isFinalStatus(match.status)) {
    return (
      <ResultView
        match={match}
        opponent={opponent}
        userId={user?.id ?? ''}
        endedPayload={endedPayload}
        myRatingDelta={data.myRatingDelta}
        onBack={() => navigate('/')}
      />
    );
  }

  switch (match.status) {
    case 'PENDING_TOSS':
      return (
        <TossView
          match={match}
          opponent={opponent}
          userId={user?.id ?? ''}
          onAccept={() => socket.emit('match:accept', { matchId: match.id })}
          onToss={() => {
            if (
              window.confirm(
                'この試合をトス（拒否）しますか？\nレートが減点される可能性があります。',
              )
            ) {
              socket.emit('match:toss', { matchId: match.id });
            }
          }}
        />
      );
    case 'IN_PROGRESS':
      return (
        <InProgressView
          match={match}
          opponent={opponent}
          userId={user?.id ?? ''}
          reports={data.reports}
          onReport={(winnerId) => socket.emit('match:report', { matchId: match.id, winnerId })}
        />
      );
    case 'WAITING_APPROVAL':
      return (
        <ApprovalView
          match={match}
          opponent={opponent}
          userId={user?.id ?? ''}
          reports={data.reports}
          onApprove={() => socket.emit('match:approve', { matchId: match.id })}
          onReportCounter={(winnerId) =>
            socket.emit('match:report', { matchId: match.id, winnerId })
          }
          onReject={(description) =>
            socket.emit('match:reject', { matchId: match.id, description })
          }
        />
      );
    case 'DISPUTED':
      return (
        <Centered>
          <h2 className="text-2xl font-bold mb-2">⚠️ 紛争中</h2>
          <p className="text-arena-subtext mb-6">
            管理者の裁定をお待ちください。
          </p>
          <BackButton onClick={() => navigate('/')} />
        </Centered>
      );
    default:
      return <Centered>未対応のステータス: {match.status}</Centered>;
  }
}

// =====================================================
// PENDING_TOSS ビュー
// =====================================================

function TossView({
  match,
  opponent,
  userId,
  onAccept,
  onToss,
}: {
  match: MatchDetail;
  opponent: UserPublic;
  userId: string;
  onAccept: () => void;
  onToss: () => void;
}) {
  const isPlayer1 = match.player1.id === userId;
  const myAccepted = isPlayer1 ? match.player1Accepted : match.player2Accepted;
  const opponentAccepted = isPlayer1 ? match.player2Accepted : match.player1Accepted;

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-2 text-center">⚔️ マッチ成立</h2>
      <p className="text-arena-subtext text-center mb-6">
        対戦相手を確認して承認してください
      </p>

      <OpponentInfo opponent={opponent} />

      <div className="grid grid-cols-2 gap-3 my-6">
        <StatusPill label="自分" value={myAccepted ? '承認済' : '未承認'} accent={myAccepted} />
        <StatusPill
          label="相手"
          value={opponentAccepted ? '承認済' : '未承認'}
          accent={opponentAccepted}
        />
      </div>

      {myAccepted ? (
        <p className="text-arena-subtext text-center">
          相手の承認を待っています...
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onToss}
            className="bg-arena-border hover:bg-rose-700 text-arena-text font-semibold py-3 rounded-xl transition-colors"
          >
            トス（拒否）
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="bg-arena-accent hover:bg-arena-accentHover text-white font-bold py-3 rounded-xl transition-colors"
          >
            承認して対戦
          </button>
        </div>
      )}
    </Card>
  );
}

// =====================================================
// IN_PROGRESS ビュー
// =====================================================

function InProgressView({
  match,
  opponent,
  userId,
  reports,
  onReport,
}: {
  match: MatchDetail;
  opponent: UserPublic;
  userId: string;
  reports: MatchReportEntry[];
  onReport: (winnerId: string) => void;
}) {
  const myReported = reports.find((r) => r.reporterId === userId);
  void match;

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-2 text-center">⚔️ 対戦中</h2>
      <p className="text-arena-subtext text-center mb-6">
        Discordで対戦してください。終了後に勝敗を報告します。
      </p>
      <OpponentInfo opponent={opponent} />

      {myReported ? (
        <p className="text-arena-subtext text-sm text-center mt-6">
          報告済みです。相手の応答を待っています...
        </p>
      ) : (
        <div className="space-y-3 mt-6">
          <p className="text-arena-subtext text-sm text-center">勝敗を報告</p>
          <button
            type="button"
            onClick={() => onReport(userId)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl"
          >
            自分が勝った
          </button>
          <button
            type="button"
            onClick={() => onReport(opponent.id)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl"
          >
            相手が勝った
          </button>
        </div>
      )}
      <p className="text-arena-subtext text-xs text-center mt-6">
        ※40分応答がないと引き分けで自動終了します
      </p>
    </Card>
  );
}

// =====================================================
// WAITING_APPROVAL ビュー
// =====================================================

function ApprovalView({
  match,
  opponent,
  userId,
  reports,
  onApprove,
  onReportCounter,
  onReject,
}: {
  match: MatchDetail;
  opponent: UserPublic;
  userId: string;
  reports: MatchReportEntry[];
  onApprove: () => void;
  onReportCounter: (winnerId: string) => void;
  onReject: (description: string) => void;
}) {
  const myReport = reports.find((r) => r.reporterId === userId);
  const opponentReport = reports.find((r) => r.reporterId !== userId);
  const [description, setDescription] = useState('');

  // 報告された勝者
  const reportedWinnerId = opponentReport?.reportedWinnerId ?? match.winnerId;
  const winnerIsMe = reportedWinnerId === userId;

  // 自分が先に報告した側 → 相手の応答待ち
  if (myReport) {
    return (
      <Card>
        <h2 className="text-2xl font-bold mb-2 text-center">📋 報告済み</h2>
        <OpponentInfo opponent={opponent} />
        <div className="bg-arena-bg border border-arena-border rounded-xl p-4 my-6 text-center">
          <p className="text-arena-subtext text-xs mb-1">あなたが報告した勝者</p>
          <p className="text-xl font-bold">
            {myReport.reportedWinnerId === userId ? '自分（あなた）' : opponent.username}
          </p>
        </div>
        <p className="text-arena-subtext text-sm text-center">
          相手の応答を待っています...
          <br />
          5分経過で自動承認されます。
        </p>
      </Card>
    );
  }

  // 相手が先に報告した側 → 承認 / 反論報告 / 異議申し立て
  return (
    <Card>
      <h2 className="text-2xl font-bold mb-2 text-center">📋 結果の確認</h2>
      <OpponentInfo opponent={opponent} />

      <div className="bg-arena-bg border border-arena-border rounded-xl p-4 my-6 text-center">
        <p className="text-arena-subtext text-xs mb-1">相手が報告した勝者</p>
        <p className="text-xl font-bold">
          {winnerIsMe ? '自分（あなた）' : opponent.username}
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onApprove}
          className="w-full bg-arena-accent hover:bg-arena-accentHover text-white font-bold py-3 rounded-xl"
        >
          承認する
        </button>

        <button
          type="button"
          onClick={() => {
            const counterWinner = winnerIsMe ? opponent.id : userId;
            if (
              window.confirm(
                '相手の報告と異なる結果として登録しますか？\n両者の報告が食い違うと、自動的に紛争状態になります。',
              )
            ) {
              onReportCounter(counterWinner);
            }
          }}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl"
        >
          {winnerIsMe ? '相手が勝ったと報告' : '自分が勝ったと報告'}
        </button>

        <details className="bg-arena-bg border border-arena-border rounded-xl p-4">
          <summary className="cursor-pointer text-sm text-arena-subtext">
            理由を添えて異議申し立て
          </summary>
          <textarea
            className="w-full mt-3 bg-arena-surface border border-arena-border rounded p-2 text-sm"
            rows={3}
            placeholder="内容を記入してください（管理者が確認します）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            disabled={description.trim().length === 0}
            onClick={() => onReject(description)}
            className="w-full mt-2 bg-rose-700 hover:bg-rose-800 disabled:bg-arena-border disabled:cursor-not-allowed text-white font-semibold py-2 rounded"
          >
            異議申し立てする
          </button>
        </details>
        <p className="text-arena-subtext text-xs text-center">
          ※5分以内に応答しないと自動承認されます
        </p>
      </div>
    </Card>
  );
}

// =====================================================
// 完了 / 引き分け ビュー
// =====================================================

function ResultView({
  match,
  opponent,
  userId,
  endedPayload,
  myRatingDelta,
  onBack,
}: {
  match: MatchDetail;
  opponent: UserPublic;
  userId: string;
  endedPayload: MatchEndedPayload | null;
  myRatingDelta: number | null;
  onBack: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [starSubmitted, setStarSubmitted] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  async function handleSubmitStars() {
    if (stars < 1) return;
    setStarError(null);
    try {
      await rateOpponent(match.id, stars);
      setStarSubmitted(true);
    } catch (e) {
      setStarError((e as Error).message);
    }
  }
  void userId;
  let title = '試合終了';
  let subtitle = '';
  let myDelta = myRatingDelta ?? 0;

  if (endedPayload) {
    if (endedPayload.outcome === 'TOSSED') {
      const tossedByMe = endedPayload.tossById === userId;
      title = tossedByMe ? 'トスしました' : '相手がトスしました';
      myDelta = tossedByMe
        ? endedPayload.tosserDelta ?? 0
        : endedPayload.receiverDelta ?? 0;
      subtitle = tossedByMe ? 'ペナルティが適用されました' : 'ボーナスを獲得しました';
    } else if (
      endedPayload.outcome === 'APPROVED' ||
      endedPayload.outcome === 'AUTO_APPROVED'
    ) {
      const wonByMe = endedPayload.winner?.id === userId;
      title = wonByMe ? '🏆 勝利！' : '💀 敗北';
      myDelta = wonByMe ? endedPayload.winnerDelta ?? 0 : endedPayload.loserDelta ?? 0;
      subtitle =
        endedPayload.outcome === 'AUTO_APPROVED'
          ? '5分経過により自動承認されました'
          : '結果が確定しました';
    } else if (endedPayload.outcome === 'TIMEOUT_DRAW') {
      title = '引き分け';
      subtitle = '40分経過により引き分けとなりました';
      myDelta = 0;
    }
  } else {
    if (match.status === 'DRAW') {
      title = '引き分け';
      myDelta = 0;
    } else if (match.tossById) {
      const tossedByMe = match.tossById === userId;
      title = tossedByMe ? 'トスしました' : '相手がトスしました';
    } else if (match.winnerId === userId) title = '🏆 勝利！';
    else if (match.winnerId) title = '💀 敗北';
  }

  return (
    <Card>
      <h2 className="text-3xl font-bold mb-1 text-center">{title}</h2>
      {subtitle && (
        <p className="text-arena-subtext text-center mb-6">{subtitle}</p>
      )}

      <OpponentInfo opponent={opponent} />

      <div className="bg-arena-bg border border-arena-border rounded-xl p-6 my-6 text-center">
        <p className="text-arena-subtext text-xs mb-2">レート変動</p>
        <p
          className={
            'text-4xl font-bold tabular-nums ' +
            (myDelta > 0
              ? 'text-emerald-400'
              : myDelta < 0
                ? 'text-rose-400'
                : 'text-arena-subtext')
          }
        >
          {formatDelta(myDelta)}
        </p>
      </div>

      <div className="bg-arena-bg border border-arena-border rounded-xl p-4 my-4">
        <p className="text-arena-subtext text-xs text-center mb-2">
          相手の試合マナーを評価（任意）
        </p>
        <StarRatingInput value={stars} onChange={setStars} disabled={starSubmitted} />
        {!starSubmitted && stars >= 1 && (
          <button
            type="button"
            onClick={handleSubmitStars}
            className="w-full mt-3 bg-arena-accent hover:bg-arena-accentHover text-white font-semibold py-2 rounded"
          >
            評価を送信
          </button>
        )}
        {starSubmitted && (
          <p className="text-emerald-400 text-sm text-center mt-2">送信しました</p>
        )}
        {starError && (
          <p className="text-arena-accent text-sm text-center mt-2">{starError}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setReportOpen(true)}
        disabled={reportSubmitted}
        className="w-full bg-arena-surface hover:bg-rose-900/30 border border-arena-border text-arena-subtext py-2 rounded-xl mb-3 text-sm disabled:opacity-50"
      >
        {reportSubmitted ? '通報を送信しました' : '相手を通報する'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full bg-arena-accent hover:bg-arena-accentHover text-white font-bold py-3 rounded-xl"
      >
        ダッシュボードへ
      </button>

      <ReportDialog
        matchId={match.id}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSuccess={() => setReportSubmitted(true)}
      />
    </Card>
  );
}

// =====================================================
// 共通コンポーネント
// =====================================================

function isFinalStatus(s: MatchDetail['status']): boolean {
  return s === 'COMPLETED' || s === 'DRAW' || s === 'CANCELLED' || s === 'INTERRUPTED';
}

function OpponentInfo({ opponent }: { opponent: UserPublic }) {
  return (
    <div className="flex items-center justify-center gap-4">
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
  );
}

function StatusPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: boolean;
}) {
  return (
    <div
      className={
        'rounded-xl p-3 text-center border ' +
        (accent
          ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
          : 'bg-arena-bg border-arena-border text-arena-subtext')
      }
    >
      <p className="text-xs mb-1">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-8 max-w-md w-full">
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-arena-accent hover:bg-arena-accentHover text-white font-semibold px-6 py-3 rounded-lg"
    >
      ダッシュボードへ
    </button>
  );
}

export default MatchPage;
