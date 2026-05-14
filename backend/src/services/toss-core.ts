/**
 * トス機能の純粋ロジック
 *
 * 仕様 §3.3:
 * - トス受諾側のポイント: +5
 * - トスペナルティ（連続）: -3 → -10 → -30 → -50（4回目以降は-50）
 * - 対戦完了でカウンターリセット
 */

export const TOSS_BONUS_FOR_RECEIVER = 5;

const PENALTY_TABLE: Record<number, number> = {
  1: -3,
  2: -10,
  3: -30,
};
const PENALTY_AT_4_OR_MORE = -50;

/**
 * 連続トス回数からペナルティ値を返す
 *
 * @param consecutiveCount このトスを含めた連続トス回数（1始まり）
 * @returns 負の値（レート減算量）
 */
export function calculateTossPenalty(consecutiveCount: number): number {
  if (consecutiveCount < 1) {
    throw new Error('consecutiveCount must be >= 1');
  }
  return PENALTY_TABLE[consecutiveCount] ?? PENALTY_AT_4_OR_MORE;
}

/**
 * トス後のレート値を計算する（最低0で下限）
 */
export function applyTossRatingChange(
  currentRating: number,
  delta: number,
): number {
  return Math.max(0, currentRating + delta);
}
