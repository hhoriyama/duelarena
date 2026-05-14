import { describe, it, expect } from 'vitest';
import {
  calculateExpectedScore,
  getKFactor,
  calculateRatingDelta,
  calculateMatchRatingChange,
  INITIAL_RATING,
  K_PROVISIONAL,
  K_NORMAL,
  PROVISIONAL_MATCH_THRESHOLD,
} from '../src/services/elo-core';

describe('calculateExpectedScore', () => {
  it('同じレートなら期待勝率0.5', () => {
    expect(calculateExpectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it('400高い相手の期待勝率は約0.0909', () => {
    // 1 / (1 + 10) = 0.0909...
    expect(calculateExpectedScore(1500, 1900)).toBeCloseTo(0.0909, 4);
  });

  it('400低い相手の期待勝率は約0.9091', () => {
    expect(calculateExpectedScore(1900, 1500)).toBeCloseTo(0.9091, 4);
  });

  it('200高い相手で約0.24', () => {
    expect(calculateExpectedScore(1500, 1700)).toBeCloseTo(0.24, 2);
  });
});

describe('getKFactor', () => {
  it(`${PROVISIONAL_MATCH_THRESHOLD}試合未満は ${K_PROVISIONAL}`, () => {
    expect(getKFactor(0)).toBe(K_PROVISIONAL);
    expect(getKFactor(5)).toBe(K_PROVISIONAL);
    expect(getKFactor(9)).toBe(K_PROVISIONAL);
  });

  it(`${PROVISIONAL_MATCH_THRESHOLD}試合以上は ${K_NORMAL}`, () => {
    expect(getKFactor(10)).toBe(K_NORMAL);
    expect(getKFactor(50)).toBe(K_NORMAL);
    expect(getKFactor(1000)).toBe(K_NORMAL);
  });
});

describe('calculateRatingDelta', () => {
  it('同レートで勝つと +K/2 程度（通常K=32 → 16）', () => {
    expect(calculateRatingDelta(1500, 1500, 1, 50)).toBe(16);
  });

  it('同レートで負けると -K/2 程度', () => {
    expect(calculateRatingDelta(1500, 1500, 0, 50)).toBe(-16);
  });

  it('Provisional期間中は変動が大きい (K=40)', () => {
    // 期待勝率0.5, K=40 → 40*(1-0.5) = 20
    expect(calculateRatingDelta(1500, 1500, 1, 0)).toBe(20);
    expect(calculateRatingDelta(1500, 1500, 0, 0)).toBe(-20);
  });

  it('格上に勝つとレート増加が大きい', () => {
    // 1500 vs 1900, 期待勝率0.0909, K=32
    // 勝った時: 32*(1 - 0.0909) = 32 * 0.9091 = 29.09 → 29
    expect(calculateRatingDelta(1500, 1900, 1, 50)).toBe(29);
  });

  it('格上に負けてもレート減少は小さい', () => {
    // 1500 vs 1900, 期待勝率0.0909, 負け
    // 32*(0 - 0.0909) = -2.91 → -3
    expect(calculateRatingDelta(1500, 1900, 0, 50)).toBe(-3);
  });

  it('格下に勝ってもレート増加は小さい', () => {
    // 1900 vs 1500, 期待勝率0.9091, 勝ち
    // 32*(1 - 0.9091) = 2.91 → 3
    expect(calculateRatingDelta(1900, 1500, 1, 50)).toBe(3);
  });

  it('格下に負けるとレート減少が大きい', () => {
    expect(calculateRatingDelta(1900, 1500, 0, 50)).toBe(-29);
  });
});

describe('calculateMatchRatingChange', () => {
  it('同レート同士の試合で勝者+16, 敗者-16', () => {
    const change = calculateMatchRatingChange({
      winnerRating: INITIAL_RATING,
      loserRating: INITIAL_RATING,
      winnerMatchCount: 50,
      loserMatchCount: 50,
    });

    expect(change.winner.delta).toBe(16);
    expect(change.winner.before).toBe(1500);
    expect(change.winner.after).toBe(1516);

    expect(change.loser.delta).toBe(-16);
    expect(change.loser.before).toBe(1500);
    expect(change.loser.after).toBe(1484);
  });

  it('Provisional同士で +20/-20', () => {
    const change = calculateMatchRatingChange({
      winnerRating: 1500,
      loserRating: 1500,
      winnerMatchCount: 0,
      loserMatchCount: 0,
    });
    expect(change.winner.delta).toBe(20);
    expect(change.loser.delta).toBe(-20);
  });

  it('レート差400で格下が勝ったケース（番狂わせ）', () => {
    const change = calculateMatchRatingChange({
      winnerRating: 1500,
      loserRating: 1900,
      winnerMatchCount: 50,
      loserMatchCount: 50,
    });
    expect(change.winner.delta).toBe(29);
    expect(change.loser.delta).toBe(-29);
  });

  it('敗者のレートは0未満にならない（下限0）', () => {
    const change = calculateMatchRatingChange({
      winnerRating: 1500,
      loserRating: 5,
      winnerMatchCount: 0,
      loserMatchCount: 0,
    });
    expect(change.loser.after).toBeGreaterThanOrEqual(0);
  });

  it('K値が prosiv./normal で混在しても各自に適用される', () => {
    // 勝者は新人(K=40), 敗者はベテラン(K=32)
    const change = calculateMatchRatingChange({
      winnerRating: 1500,
      loserRating: 1500,
      winnerMatchCount: 0,
      loserMatchCount: 50,
    });
    expect(change.winner.delta).toBe(20);
    expect(change.loser.delta).toBe(-16);
  });
});
