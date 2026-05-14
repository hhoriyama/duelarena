/**
 * Eloレーティング計算（純粋関数）
 *
 * 仕様 §3.5:
 * - 初期レート 1500
 * - K値:
 *   - Provisional期間（10試合未満）: 40
 *   - 通常: 32
 * - 引き分けは「両者引き分け扱い、レート変動なし」のみ存在（40分タイムアウト）
 *   通常の試合は引き分けなし
 */

export const INITIAL_RATING = 1500;
export const K_PROVISIONAL = 40;
export const K_NORMAL = 32;
export const PROVISIONAL_MATCH_THRESHOLD = 10;

/**
 * 期待勝率を計算する
 * E_a = 1 / (1 + 10^((R_b - R_a) / 400))
 */
export function calculateExpectedScore(
  myRating: number,
  opponentRating: number,
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

/**
 * 試合数からK値を返す
 */
export function getKFactor(matchCount: number): number {
  return matchCount < PROVISIONAL_MATCH_THRESHOLD ? K_PROVISIONAL : K_NORMAL;
}

/**
 * Elo計算でレート変動量（delta）を返す。
 *
 * @param myRating         自分の現在レート
 * @param opponentRating   相手の現在レート
 * @param actualScore      実際のスコア（勝1, 負0, 引分0.5）
 * @param matchCount       自分の試合数（K値判定用）
 */
export function calculateRatingDelta(
  myRating: number,
  opponentRating: number,
  actualScore: number,
  matchCount: number,
): number {
  const expected = calculateExpectedScore(myRating, opponentRating);
  const k = getKFactor(matchCount);
  // 整数で丸める（Eloでは慣習的に四捨五入）
  return Math.round(k * (actualScore - expected));
}

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
}

export interface MatchRatingChange {
  winner: RatingChange;
  loser: RatingChange;
}

/**
 * 勝者・敗者のレート変動を計算する
 */
export function calculateMatchRatingChange(args: {
  winnerRating: number;
  loserRating: number;
  winnerMatchCount: number;
  loserMatchCount: number;
}): MatchRatingChange {
  const winnerDelta = calculateRatingDelta(
    args.winnerRating,
    args.loserRating,
    1,
    args.winnerMatchCount,
  );
  const loserDelta = calculateRatingDelta(
    args.loserRating,
    args.winnerRating,
    0,
    args.loserMatchCount,
  );

  return {
    winner: {
      before: args.winnerRating,
      after: args.winnerRating + winnerDelta,
      delta: winnerDelta,
    },
    loser: {
      before: args.loserRating,
      after: Math.max(0, args.loserRating + loserDelta),
      delta: loserDelta,
    },
  };
}
