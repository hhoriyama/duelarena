/**
 * マッチングのコアロジック（純粋関数）
 *
 * DBやネットワーク I/O を持たないため、ユニットテストで100%カバレッジを取れる。
 *
 * 仕様 §3.2:
 * - 初期許容レート差: ±100
 * - 1分ごとに +50 拡張
 * - 5分でタイムアウト
 * - 直近2試合の対戦相手とは再マッチしない
 */

export const INITIAL_RANGE = 100;
export const RANGE_INCREMENT = 50;
export const RANGE_INCREMENT_INTERVAL_MS = 60_000;
export const TIMEOUT_MS = 5 * 60_000;
export const RECENT_OPPONENTS_BLOCK_COUNT = 2;

/**
 * 待機時間に応じた現在の許容レート差を計算する
 */
export function computeRange(enteredAt: Date, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - enteredAt.getTime();
  if (elapsedMs <= 0) return INITIAL_RANGE;
  const incr = Math.floor(elapsedMs / RANGE_INCREMENT_INTERVAL_MS);
  return INITIAL_RANGE + incr * RANGE_INCREMENT;
}

/**
 * タイムアウトしたかどうか
 */
export function isExpired(enteredAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - enteredAt.getTime() > TIMEOUT_MS;
}

export interface CandidateInput {
  userId: string;
  rating: number;
  enteredAt: Date;
  /** この候補者がブロックしている相手（直近2試合の対戦相手） */
  blockedOpponents: string[];
  /** 平均星評価（未評価ならnull） */
  averageStarRating?: number | null;
}

export interface MatchableInput {
  userId: string;
  rating: number;
  enteredAt: Date;
  blockedOpponents: string[];
  averageStarRating?: number | null;
}

/**
 * 自分とマッチ可能な候補を探す。最も近いレートの相手を返す。
 *
 * マッチ条件：
 * - 自分・相手 双方の許容レート差以内
 * - 双方の直近対戦相手リストに含まれない
 * - 候補者がタイムアウトしていない
 */
export const STAR_RATING_DIFF_THRESHOLD = 1.5;

function withinStarThreshold(
  myAverage: number | null | undefined,
  opponentAverage: number | null | undefined,
): boolean {
  if (myAverage == null || opponentAverage == null) return true;
  return Math.abs(myAverage - opponentAverage) <= STAR_RATING_DIFF_THRESHOLD;
}

export function findMatch(
  forUser: MatchableInput,
  candidates: CandidateInput[],
  now: Date = new Date(),
): CandidateInput | null {
  const myRange = computeRange(forUser.enteredAt, now);
  const myBlocked = new Set(forUser.blockedOpponents);

  const valid = candidates.filter((c) => {
    if (c.userId === forUser.userId) return false;
    if (isExpired(c.enteredAt, now)) return false;
    if (myBlocked.has(c.userId)) return false;
    if (c.blockedOpponents.includes(forUser.userId)) return false;
    if (!withinStarThreshold(forUser.averageStarRating, c.averageStarRating)) {
      return false;
    }
    const theirRange = computeRange(c.enteredAt, now);
    const diff = Math.abs(c.rating - forUser.rating);
    return diff <= myRange && diff <= theirRange;
  });

  if (valid.length === 0) return null;

  // 最もレート差が小さい相手を選ぶ。同点なら待機時間が長い方を優先。
  valid.sort((a, b) => {
    const diffA = Math.abs(a.rating - forUser.rating);
    const diffB = Math.abs(b.rating - forUser.rating);
    if (diffA !== diffB) return diffA - diffB;
    return a.enteredAt.getTime() - b.enteredAt.getTime();
  });

  return valid[0];
}

/**
 * キュー全体から、マッチ可能なペアを貪欲に抽出する。
 * tick処理（定期実行）で使用。
 */
export function findAllMatches(
  entries: CandidateInput[],
  now: Date = new Date(),
): { matched: Array<[CandidateInput, CandidateInput]>; remaining: CandidateInput[] } {
  const matched: Array<[CandidateInput, CandidateInput]> = [];
  const used = new Set<string>();
  // 古い順に処理
  const sorted = [...entries].sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());

  for (const entry of sorted) {
    if (used.has(entry.userId)) continue;
    if (isExpired(entry.enteredAt, now)) continue;

    const candidates = sorted.filter((c) => !used.has(c.userId));
    const opponent = findMatch(
      {
        userId: entry.userId,
        rating: entry.rating,
        enteredAt: entry.enteredAt,
        blockedOpponents: entry.blockedOpponents,
      },
      candidates,
      now,
    );
    if (opponent) {
      matched.push([entry, opponent]);
      used.add(entry.userId);
      used.add(opponent.userId);
    }
  }

  const remaining = entries.filter(
    (e) => !used.has(e.userId) && !isExpired(e.enteredAt, now),
  );
  return { matched, remaining };
}
