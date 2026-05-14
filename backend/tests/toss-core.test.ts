import { describe, it, expect } from 'vitest';
import {
  calculateTossPenalty,
  applyTossRatingChange,
  TOSS_BONUS_FOR_RECEIVER,
} from '../src/services/toss-core';

describe('calculateTossPenalty', () => {
  it('1回目のトスは -3', () => {
    expect(calculateTossPenalty(1)).toBe(-3);
  });

  it('2回目のトスは -10', () => {
    expect(calculateTossPenalty(2)).toBe(-10);
  });

  it('3回目のトスは -30', () => {
    expect(calculateTossPenalty(3)).toBe(-30);
  });

  it('4回目のトスは -50', () => {
    expect(calculateTossPenalty(4)).toBe(-50);
  });

  it('5回目以降も -50 で頭打ち', () => {
    expect(calculateTossPenalty(5)).toBe(-50);
    expect(calculateTossPenalty(10)).toBe(-50);
    expect(calculateTossPenalty(100)).toBe(-50);
  });

  it('0以下は不正値としてthrow', () => {
    expect(() => calculateTossPenalty(0)).toThrow();
    expect(() => calculateTossPenalty(-1)).toThrow();
  });
});

describe('applyTossRatingChange', () => {
  it('正の変動はそのまま加算', () => {
    expect(applyTossRatingChange(1500, 5)).toBe(1505);
  });

  it('負の変動はそのまま減算', () => {
    expect(applyTossRatingChange(1500, -10)).toBe(1490);
  });

  it('0未満になる場合は0で下限', () => {
    expect(applyTossRatingChange(20, -50)).toBe(0);
    expect(applyTossRatingChange(0, -10)).toBe(0);
  });

  it('境界値: 0ちょうどは0のまま', () => {
    expect(applyTossRatingChange(50, -50)).toBe(0);
  });
});

describe('TOSS_BONUS_FOR_RECEIVER', () => {
  it('受諾側のポイントは +5', () => {
    expect(TOSS_BONUS_FOR_RECEIVER).toBe(5);
  });
});
