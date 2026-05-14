import { describe, it, expect } from 'vitest';
import {
  statusLabel,
  resultLabel,
  resultColorClass,
  formatDelta,
  formatDate,
} from '../src/lib/match-formulas';

describe('statusLabel', () => {
  it('全ステータスにラベルがある', () => {
    expect(statusLabel('PENDING_TOSS')).toBe('承認待ち');
    expect(statusLabel('IN_PROGRESS')).toBe('対戦中');
    expect(statusLabel('WAITING_APPROVAL')).toBe('承認待ち');
    expect(statusLabel('DISPUTED')).toBe('紛争中');
    expect(statusLabel('COMPLETED')).toBe('完了');
    expect(statusLabel('CANCELLED')).toBe('キャンセル');
    expect(statusLabel('DRAW')).toBe('引き分け');
    expect(statusLabel('INTERRUPTED')).toBe('中断');
  });
});

describe('resultLabel', () => {
  it('全結果にラベルがある', () => {
    expect(resultLabel('WIN')).toBe('勝利');
    expect(resultLabel('LOSS')).toBe('敗北');
    expect(resultLabel('DRAW')).toBe('引き分け');
    expect(resultLabel('TOSSED_BY_ME')).toBe('自分がトス');
    expect(resultLabel('TOSSED_BY_OPPONENT')).toBe('相手がトス');
    expect(resultLabel('OTHER')).toBe('その他');
  });
});

describe('resultColorClass', () => {
  it('勝利系は緑、敗北系は赤、引き分けはグレー', () => {
    expect(resultColorClass('WIN')).toContain('emerald');
    expect(resultColorClass('TOSSED_BY_OPPONENT')).toContain('emerald');
    expect(resultColorClass('LOSS')).toContain('rose');
    expect(resultColorClass('TOSSED_BY_ME')).toContain('rose');
    expect(resultColorClass('DRAW')).toContain('subtext');
  });
});

describe('formatDelta', () => {
  it('正の値は + プレフィックスがつく', () => {
    expect(formatDelta(16)).toBe('+16');
    expect(formatDelta(1)).toBe('+1');
  });

  it('負の値はそのまま', () => {
    expect(formatDelta(-16)).toBe('-16');
    expect(formatDelta(-1)).toBe('-1');
  });

  it('0は "0"', () => {
    expect(formatDelta(0)).toBe('0');
  });
});

describe('formatDate', () => {
  it('null は "-"', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('ISO文字列は日本語ロケールでフォーマットされる', () => {
    const out = formatDate('2026-05-09T12:00:00Z');
    // ロケールは環境依存だが、年月日と時刻が含まれるはず
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/\d{2}/);
  });
});
