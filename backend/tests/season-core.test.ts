import { describe, it, expect } from 'vitest';
import { computeSeasonRange, determineTitle } from '../src/services/season-core';

describe('computeSeasonRange', () => {
  it('開始日から3ヶ月後の同日が終了日', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    const range = computeSeasonRange(start);
    expect(range.end.toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('時刻成分は0:00 UTCに正規化', () => {
    const start = new Date('2026-01-15T15:30:00Z');
    const range = computeSeasonRange(start);
    expect(range.start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });
});

describe('determineTitle', () => {
  it('1位は王者', () => {
    expect(determineTitle('シーズン1', 1, 100)).toBe('シーズン1王者');
  });
  it('上位10%以内', () => {
    expect(determineTitle('シーズン1', 5, 100)).toBe('シーズン1上位10%');
    expect(determineTitle('シーズン1', 10, 100)).toBe('シーズン1上位10%');
  });
  it('上位30%以内', () => {
    expect(determineTitle('シーズン1', 11, 100)).toBe('シーズン1上位30%');
    expect(determineTitle('シーズン1', 30, 100)).toBe('シーズン1上位30%');
  });
  it('それ以下は称号なし', () => {
    expect(determineTitle('シーズン1', 31, 100)).toBeNull();
    expect(determineTitle('シーズン1', 100, 100)).toBeNull();
  });
  it('参加者0や範囲外はnull', () => {
    expect(determineTitle('シーズン1', 1, 0)).toBeNull();
    expect(determineTitle('シーズン1', 0, 100)).toBeNull();
    expect(determineTitle('シーズン1', 101, 100)).toBeNull();
  });
});
