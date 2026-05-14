/**
 * バックエンド matchmaking-core と同じ定数。
 * フロント側でも待機時間→許容レート差を計算して表示する。
 */

export const INITIAL_RANGE = 100;
export const RANGE_INCREMENT = 50;
export const RANGE_INCREMENT_INTERVAL_MS = 60_000;
export const TIMEOUT_MS = 5 * 60_000;

export function computeRange(enteredAt: Date, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - enteredAt.getTime();
  if (elapsedMs <= 0) return INITIAL_RANGE;
  const incr = Math.floor(elapsedMs / RANGE_INCREMENT_INTERVAL_MS);
  return INITIAL_RANGE + incr * RANGE_INCREMENT;
}

export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
