/**
 * シーズン関連の純粋ロジック
 *
 * 仕様 §3.7:
 * - 3ヶ月単位
 * - シーズン終了時にレートを完全リセット (1500)
 * - 順位ベースで称号付与
 * - 月間ランキング機能
 */

export const SEASON_DURATION_MONTHS = 3;
export const RESET_RATING = 1500;

/**
 * 与えられた日付から、シーズン開始・終了日を計算する
 *
 * 単純な実装: 開始日から3ヶ月後の同日0:00に終了
 */
export function computeSeasonRange(start: Date): { start: Date; end: Date } {
  const startUtc = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const end = new Date(startUtc);
  end.setUTCMonth(end.getUTCMonth() + SEASON_DURATION_MONTHS);
  return { start: startUtc, end };
}

/**
 * シーズン終了時に順位から称号を決める
 *
 * 1位 → 「シーズンX王者」
 * 上位10% → 「シーズンX上位10%」
 * 上位30% → 「シーズンX上位30%」
 * それ以下 → 称号なし
 */
export function determineTitle(
  seasonName: string,
  rank: number,
  totalParticipants: number,
): string | null {
  if (rank < 1 || rank > totalParticipants || totalParticipants <= 0) return null;
  if (rank === 1) return `${seasonName}王者`;
  const percentile = (rank / totalParticipants) * 100;
  if (percentile <= 10) return `${seasonName}上位10%`;
  if (percentile <= 30) return `${seasonName}上位30%`;
  return null;
}
