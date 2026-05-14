import { describe, it, expect } from 'vitest';
import {
  isValidStar,
  recalculateAverage,
  isWithinStarThreshold,
  MATCHING_DIFF_THRESHOLD,
} from '../src/services/star-rating-core';

describe('isValidStar', () => {
  it('1〜5の整数のみtrue', () => {
    expect(isValidStar(1)).toBe(true);
    expect(isValidStar(3)).toBe(true);
    expect(isValidStar(5)).toBe(true);
  });
  it('範囲外はfalse', () => {
    expect(isValidStar(0)).toBe(false);
    expect(isValidStar(6)).toBe(false);
    expect(isValidStar(-1)).toBe(false);
  });
  it('小数はfalse', () => {
    expect(isValidStar(3.5)).toBe(false);
  });
});

describe('recalculateAverage', () => {
  it('未評価 + 新規4 → 4', () => {
    expect(recalculateAverage(null, 0, 4)).toBe(4);
  });
  it('平均4で2件 + 新規5 → 4.333', () => {
    // (4*2 + 5) / 3 = 13/3 = 4.333
    expect(recalculateAverage(4, 2, 5)).toBeCloseTo(4.333, 2);
  });
  it('平均5で5件 + 新規1 → 4.333', () => {
    // (5*5 + 1) / 6 = 26/6 = 4.333
    expect(recalculateAverage(5, 5, 1)).toBeCloseTo(4.333, 2);
  });
  it('不正な値はthrow', () => {
    expect(() => recalculateAverage(null, 0, 6)).toThrow();
    expect(() => recalculateAverage(null, 0, 0)).toThrow();
  });
});

describe('isWithinStarThreshold', () => {
  it('両方未評価ならtrue', () => {
    expect(isWithinStarThreshold(null, null)).toBe(true);
  });
  it('片方が未評価ならtrue（評価ハードルにしない）', () => {
    expect(isWithinStarThreshold(3.0, null)).toBe(true);
    expect(isWithinStarThreshold(null, 4.0)).toBe(true);
  });
  it(`差が${MATCHING_DIFF_THRESHOLD}以内ならtrue`, () => {
    expect(isWithinStarThreshold(3.0, 4.0)).toBe(true);
    expect(isWithinStarThreshold(3.0, 4.5)).toBe(true);
  });
  it(`差が${MATCHING_DIFF_THRESHOLD}超ならfalse`, () => {
    expect(isWithinStarThreshold(2.0, 4.0)).toBe(false);
    expect(isWithinStarThreshold(5.0, 1.0)).toBe(false);
  });
  it('閾値ちょうどはtrue', () => {
    expect(isWithinStarThreshold(3.0, 4.5)).toBe(true);
    expect(isWithinStarThreshold(4.5, 3.0)).toBe(true);
  });
});
