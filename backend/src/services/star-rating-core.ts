/**
 * 星評価の純粋ロジック
 *
 * 仕様 §3.6:
 * - 1〜5の星評価
 * - マッチング時に平均評価が大きく離れている相手を除外
 * - 自分が相手につけた評価も記録（荒らし対策）
 */

export const MIN_STAR = 1;
export const MAX_STAR = 5;
export const MATCHING_DIFF_THRESHOLD = 1.5;

export function isValidStar(stars: number): boolean {
  return Number.isInteger(stars) && stars >= MIN_STAR && stars <= MAX_STAR;
}

/**
 * 既存の平均と新規評価から、新しい平均を再計算する
 *
 * @param previousAverage 現在の平均（未評価ならnull）
 * @param previousCount   評価件数
 * @param newStars        新しい評価
 * @returns 新しい平均
 */
export function recalculateAverage(
  previousAverage: number | null,
  previousCount: number,
  newStars: number,
): number {
  if (!isValidStar(newStars)) {
    throw new Error(`Invalid stars: ${newStars}`);
  }
  if (previousCount <= 0 || previousAverage === null) {
    return newStars;
  }
  const total = previousAverage * previousCount + newStars;
  return Number((total / (previousCount + 1)).toFixed(3));
}

/**
 * 2人の星評価の差がマッチング閾値内かどうか
 * いずれかが未評価ならマッチング可能扱い（true）
 */
export function isWithinStarThreshold(
  myAverage: number | null,
  opponentAverage: number | null,
  threshold: number = MATCHING_DIFF_THRESHOLD,
): boolean {
  if (myAverage === null || opponentAverage === null) return true;
  return Math.abs(myAverage - opponentAverage) <= threshold;
}
