import { describe, it, expect } from 'vitest';
import {
  computeRange,
  formatElapsed,
  INITIAL_RANGE,
} from '../src/lib/queue-formulas';

const NOW = new Date('2026-01-01T00:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('computeRange (フロント側)', () => {
  it('入った直後は初期値', () => {
    expect(computeRange(NOW, NOW)).toBe(INITIAL_RANGE);
  });

  it('1分経過で +50', () => {
    expect(computeRange(ago(60_000), NOW)).toBe(150);
  });

  it('3分経過で 250', () => {
    expect(computeRange(ago(180_000), NOW)).toBe(250);
  });
});

describe('formatElapsed', () => {
  it('0秒は "0:00"', () => {
    expect(formatElapsed(0)).toBe('0:00');
  });

  it('59秒は "0:59"', () => {
    expect(formatElapsed(59_000)).toBe('0:59');
  });

  it('1分は "1:00"', () => {
    expect(formatElapsed(60_000)).toBe('1:00');
  });

  it('5分30秒は "5:30"', () => {
    expect(formatElapsed(330_000)).toBe('5:30');
  });

  it('負の値は0扱い', () => {
    expect(formatElapsed(-5000)).toBe('0:00');
  });
});
