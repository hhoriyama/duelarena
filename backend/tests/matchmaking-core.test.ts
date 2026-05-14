import { describe, it, expect } from 'vitest';
import {
  computeRange,
  isExpired,
  findMatch,
  findAllMatches,
  INITIAL_RANGE,
  TIMEOUT_MS,
  type CandidateInput,
} from '../src/services/matchmaking-core';

const NOW = new Date('2026-01-01T00:00:00Z');

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe('computeRange', () => {
  it('入った直後は初期値 100', () => {
    expect(computeRange(NOW, NOW)).toBe(100);
  });

  it('30秒後でも 100（まだ拡張されない）', () => {
    expect(computeRange(ago(30_000), NOW)).toBe(100);
  });

  it('1分経過で 150', () => {
    expect(computeRange(ago(60_000), NOW)).toBe(150);
  });

  it('2分経過で 200', () => {
    expect(computeRange(ago(120_000), NOW)).toBe(200);
  });

  it('4分59秒で 300', () => {
    expect(computeRange(ago(4 * 60_000 + 59_000), NOW)).toBe(300);
  });

  it('未来の時刻が渡されたら初期値', () => {
    expect(computeRange(new Date(NOW.getTime() + 1000), NOW)).toBe(100);
  });
});

describe('isExpired', () => {
  it('5分以内ならfalse', () => {
    expect(isExpired(ago(TIMEOUT_MS - 1000), NOW)).toBe(false);
  });

  it('5分ちょうどはfalse（境界値）', () => {
    expect(isExpired(ago(TIMEOUT_MS), NOW)).toBe(false);
  });

  it('5分1ミリ秒経過でtrue', () => {
    expect(isExpired(ago(TIMEOUT_MS + 1), NOW)).toBe(true);
  });
});

describe('findMatch', () => {
  const me = {
    userId: 'me',
    rating: 1500,
    enteredAt: NOW,
    blockedOpponents: [] as string[],
  };

  it('レート差100以内の相手とマッチする', () => {
    const candidates: CandidateInput[] = [
      { userId: 'a', rating: 1450, enteredAt: NOW, blockedOpponents: [] },
    ];
    const m = findMatch(me, candidates, NOW);
    expect(m?.userId).toBe('a');
  });

  it('レート差101はマッチしない（初期範囲）', () => {
    const candidates: CandidateInput[] = [
      { userId: 'a', rating: 1601, enteredAt: NOW, blockedOpponents: [] },
    ];
    expect(findMatch(me, candidates, NOW)).toBeNull();
  });

  it('双方の待機時間が長くなれば、より広いレート差でマッチする', () => {
    // me: 入りたて(範囲100)
    // a: 1分待機(範囲150) で レート差140
    // → me側の範囲で見ると 140 <= 100 ではないのでマッチしない
    const candidates: CandidateInput[] = [
      { userId: 'a', rating: 1640, enteredAt: ago(60_000), blockedOpponents: [] },
    ];
    expect(findMatch(me, candidates, NOW)).toBeNull();

    // 自分が1分待機すれば範囲150になり、レート差140でマッチする
    const meWaited = { ...me, enteredAt: ago(60_000) };
    const m = findMatch(meWaited, candidates, NOW);
    expect(m?.userId).toBe('a');
  });

  it('自分のblockedOpponentsに含まれる相手は除外', () => {
    const candidates: CandidateInput[] = [
      { userId: 'a', rating: 1500, enteredAt: NOW, blockedOpponents: [] },
    ];
    const blockedMe = { ...me, blockedOpponents: ['a'] };
    expect(findMatch(blockedMe, candidates, NOW)).toBeNull();
  });

  it('相手のblockedOpponentsに自分が含まれていれば除外', () => {
    const candidates: CandidateInput[] = [
      { userId: 'a', rating: 1500, enteredAt: NOW, blockedOpponents: ['me'] },
    ];
    expect(findMatch(me, candidates, NOW)).toBeNull();
  });

  it('タイムアウトした相手は除外', () => {
    const candidates: CandidateInput[] = [
      {
        userId: 'a',
        rating: 1500,
        enteredAt: ago(TIMEOUT_MS + 1000),
        blockedOpponents: [],
      },
    ];
    expect(findMatch(me, candidates, NOW)).toBeNull();
  });

  it('複数候補があるとレート差が最小の相手を返す', () => {
    const candidates: CandidateInput[] = [
      { userId: 'far', rating: 1580, enteredAt: NOW, blockedOpponents: [] },
      { userId: 'near', rating: 1495, enteredAt: NOW, blockedOpponents: [] },
      { userId: 'mid', rating: 1530, enteredAt: NOW, blockedOpponents: [] },
    ];
    expect(findMatch(me, candidates, NOW)?.userId).toBe('near');
  });

  it('レート差が同点なら待機時間が長い方を優先', () => {
    const candidates: CandidateInput[] = [
      { userId: 'newer', rating: 1450, enteredAt: NOW, blockedOpponents: [] },
      { userId: 'older', rating: 1450, enteredAt: ago(30_000), blockedOpponents: [] },
    ];
    expect(findMatch(me, candidates, NOW)?.userId).toBe('older');
  });

  it('自分自身は候補から除外', () => {
    const candidates: CandidateInput[] = [
      { userId: 'me', rating: 1500, enteredAt: NOW, blockedOpponents: [] },
    ];
    expect(findMatch(me, candidates, NOW)).toBeNull();
  });

  it(`${INITIAL_RANGE}差ちょうどはマッチする（境界値）`, () => {
    const candidates: CandidateInput[] = [
      { userId: 'a', rating: 1500 + INITIAL_RANGE, enteredAt: NOW, blockedOpponents: [] },
    ];
    expect(findMatch(me, candidates, NOW)?.userId).toBe('a');
  });
});

describe('findAllMatches', () => {
  it('複数ペアを貪欲に抽出する', () => {
    const entries: CandidateInput[] = [
      { userId: 'a', rating: 1500, enteredAt: ago(10_000), blockedOpponents: [] },
      { userId: 'b', rating: 1510, enteredAt: ago(8_000), blockedOpponents: [] },
      { userId: 'c', rating: 2000, enteredAt: ago(6_000), blockedOpponents: [] },
      { userId: 'd', rating: 1990, enteredAt: ago(4_000), blockedOpponents: [] },
    ];
    const { matched, remaining } = findAllMatches(entries, NOW);
    expect(matched).toHaveLength(2);
    expect(remaining).toHaveLength(0);
    const matchedIds = matched.flat().map((e) => e.userId).sort();
    expect(matchedIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('マッチできない人は remaining に残る', () => {
    const entries: CandidateInput[] = [
      { userId: 'a', rating: 1500, enteredAt: ago(10_000), blockedOpponents: [] },
      { userId: 'b', rating: 2000, enteredAt: ago(8_000), blockedOpponents: [] },
    ];
    const { matched, remaining } = findAllMatches(entries, NOW);
    expect(matched).toHaveLength(0);
    expect(remaining.map((e) => e.userId).sort()).toEqual(['a', 'b']);
  });

  it('タイムアウト分は remaining にも matched にも含まれない', () => {
    const entries: CandidateInput[] = [
      {
        userId: 'expired',
        rating: 1500,
        enteredAt: ago(TIMEOUT_MS + 1000),
        blockedOpponents: [],
      },
      { userId: 'fresh', rating: 1500, enteredAt: NOW, blockedOpponents: [] },
    ];
    const { matched, remaining } = findAllMatches(entries, NOW);
    expect(matched).toHaveLength(0);
    expect(remaining.map((e) => e.userId)).toEqual(['fresh']);
  });

  it('古い順にマッチさせる（待機時間が長い人優先）', () => {
    const entries: CandidateInput[] = [
      { userId: 'old', rating: 1500, enteredAt: ago(60_000), blockedOpponents: [] },
      { userId: 'new', rating: 1500, enteredAt: NOW, blockedOpponents: [] },
      { userId: 'newer', rating: 1500, enteredAt: NOW, blockedOpponents: [] },
    ];
    const { matched } = findAllMatches(entries, NOW);
    expect(matched).toHaveLength(1);
    // oldが最初に処理されるはず
    expect(matched[0].some((p) => p.userId === 'old')).toBe(true);
  });
});
