import { describe, it, expect } from 'vitest';
import {
  decideReportOutcome,
  canApprove,
  type ReportRecord,
} from '../src/services/match-report-core';

describe('decideReportOutcome', () => {
  it('既存報告なし → WAITING', () => {
    const out = decideReportOutcome([], {
      reporterId: 'A',
      reportedWinnerId: 'A',
    });
    expect(out).toEqual({ kind: 'WAITING', winnerId: 'A' });
  });

  it('既存報告と新規報告の勝者が一致 → COMPLETED', () => {
    const existing: ReportRecord[] = [{ reporterId: 'A', reportedWinnerId: 'A' }];
    const out = decideReportOutcome(existing, {
      reporterId: 'B',
      reportedWinnerId: 'A',
    });
    expect(out).toEqual({ kind: 'COMPLETED', winnerId: 'A' });
  });

  it('既存報告と新規報告の勝者が不一致 → DISPUTED', () => {
    const existing: ReportRecord[] = [{ reporterId: 'A', reportedWinnerId: 'A' }];
    const out = decideReportOutcome(existing, {
      reporterId: 'B',
      reportedWinnerId: 'B',
    });
    expect(out).toEqual({ kind: 'DISPUTED' });
  });

  it('「自分が負け」を両者が報告した場合（同じ勝者）→ COMPLETED', () => {
    // A報告: 勝者はB(自分が負け), B報告: 勝者もB
    const existing: ReportRecord[] = [{ reporterId: 'A', reportedWinnerId: 'B' }];
    const out = decideReportOutcome(existing, {
      reporterId: 'B',
      reportedWinnerId: 'B',
    });
    expect(out).toEqual({ kind: 'COMPLETED', winnerId: 'B' });
  });

  it('既存に自分の報告だけある状態でも WAITING（呼び出しガード保険）', () => {
    const existing: ReportRecord[] = [{ reporterId: 'A', reportedWinnerId: 'A' }];
    const out = decideReportOutcome(existing, {
      reporterId: 'A',
      reportedWinnerId: 'A',
    });
    expect(out).toEqual({ kind: 'WAITING', winnerId: 'A' });
  });
});

describe('canApprove', () => {
  it('報告がない場合は承認不可', () => {
    expect(canApprove([], 'X')).toBe(false);
  });

  it('他人の報告だけがある場合は承認可', () => {
    const reports: ReportRecord[] = [{ reporterId: 'A', reportedWinnerId: 'A' }];
    expect(canApprove(reports, 'B')).toBe(true);
  });

  it('自分の報告がある場合は承認不可（自分の報告は自分で承認できない）', () => {
    const reports: ReportRecord[] = [{ reporterId: 'A', reportedWinnerId: 'A' }];
    expect(canApprove(reports, 'A')).toBe(false);
  });

  it('複数の報告があり自分のものが含まれていれば不可', () => {
    const reports: ReportRecord[] = [
      { reporterId: 'A', reportedWinnerId: 'A' },
      { reporterId: 'B', reportedWinnerId: 'B' },
    ];
    expect(canApprove(reports, 'A')).toBe(false);
    expect(canApprove(reports, 'B')).toBe(false);
  });
});
