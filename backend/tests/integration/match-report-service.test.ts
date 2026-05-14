import { describe, it, expect, beforeEach } from 'vitest';
import {
  reportWin,
  approveReport,
  rejectReport,
  autoApprove,
  markAsDraw,
  tickMatchTimeouts,
  AUTO_APPROVE_TIMEOUT_MS,
  DRAW_TIMEOUT_MS,
} from '../../src/services/match-report-service';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createVeteranUser, createMatch } from './helpers/seed';

describe('match-report-service (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('reportWin（単独報告）', () => {
    it('IN_PROGRESS で1人目が報告すると WAITING_APPROVAL に', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const result = await reportWin(testPrisma, m.id, a.id, a.id);
      expect(result.outcome).toBe('WAITING');
      expect(result.match.status).toBe('WAITING_APPROVAL');
      expect(result.match.winnerId).toBe(a.id);
      expect(result.match.reportedAt).not.toBeNull();
    });

    it('IN_PROGRESS でなければ報告できない', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id);
      await expect(reportWin(testPrisma, m.id, a.id, a.id)).rejects.toThrow();
    });

    it('参加者以外は報告できない', async () => {
      const a = await createUser();
      const b = await createUser();
      const c = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await expect(reportWin(testPrisma, m.id, c.id, a.id)).rejects.toThrow(/参加者/);
    });

    it('参加者以外を勝者にすることはできない', async () => {
      const a = await createUser();
      const b = await createUser();
      const c = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await expect(reportWin(testPrisma, m.id, a.id, c.id)).rejects.toThrow(/勝者/);
    });

    it('同一プレイヤーの2回目報告は拒否', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      await expect(reportWin(testPrisma, m.id, a.id, a.id)).rejects.toThrow(/既に報告/);
    });
  });

  describe('reportWin（両者報告で整合判定）', () => {
    it('一致 → COMPLETED + Elo適用', async () => {
      const a = await createVeteranUser({ currentRating: 1500 });
      const b = await createVeteranUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      const result = await reportWin(testPrisma, m.id, b.id, a.id);
      expect(result.outcome).toBe('COMPLETED');
      expect(result.match.status).toBe('COMPLETED');
      expect(result.match.winnerId).toBe(a.id);
      const winner = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      const loser = await testPrisma.user.findUniqueOrThrow({ where: { id: b.id } });
      expect(winner.currentRating).toBe(1516);
      expect(loser.currentRating).toBe(1484);
      expect(winner.wins).toBe(1);
      expect(loser.losses).toBe(1);
    });

    it('不一致 → DISPUTED', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      const result = await reportWin(testPrisma, m.id, b.id, b.id);
      expect(result.outcome).toBe('DISPUTED');
      expect(result.match.status).toBe('DISPUTED');
      expect(result.match.winnerId).toBeNull();
      expect(result.disputeId).toBeDefined();
      const dispute = await testPrisma.dispute.findUnique({
        where: { id: result.disputeId! },
      });
      expect(dispute?.status).toBe('OPEN');
    });
  });

  describe('approveReport', () => {
    it('相手の報告を承認 → COMPLETED', async () => {
      const a = await createVeteranUser({ currentRating: 1500 });
      const b = await createVeteranUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      const result = await approveReport(testPrisma, m.id, b.id);
      expect(result.outcome).toBe('COMPLETED');
      expect(result.finalize?.winner.id).toBe(a.id);
    });

    it('自分の報告は自分で承認できない', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      await expect(approveReport(testPrisma, m.id, a.id)).rejects.toThrow(/自分の報告/);
    });

    it('WAITING_APPROVAL でなければ承認できない', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await expect(approveReport(testPrisma, m.id, a.id)).rejects.toThrow();
    });
  });

  describe('rejectReport', () => {
    it('相手の報告に異議申し立て → DISPUTED', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      const result = await rejectReport(testPrisma, m.id, b.id, '異議あり');
      expect(result.match.status).toBe('DISPUTED');
      const dispute = await testPrisma.dispute.findUnique({
        where: { id: result.disputeId },
      });
      expect(dispute?.description).toBe('異議あり');
      expect(dispute?.status).toBe('OPEN');
    });

    it('自分の報告には異議申し立てできない', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      await expect(rejectReport(testPrisma, m.id, a.id, 'x')).rejects.toThrow(/自分/);
    });
  });

  describe('autoApprove', () => {
    it('WAITING_APPROVAL を自動承認して COMPLETED にする', async () => {
      const a = await createVeteranUser({ currentRating: 1500 });
      const b = await createVeteranUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await reportWin(testPrisma, m.id, a.id, a.id);
      const result = await autoApprove(testPrisma, m.id);
      expect(result.outcome).toBe('COMPLETED');
      const winner = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      expect(winner.currentRating).toBe(1516);
    });
  });

  describe('markAsDraw', () => {
    it('IN_PROGRESS を DRAW にする（レート変動なし）', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const result = await markAsDraw(testPrisma, m.id);
      expect(result.status).toBe('DRAW');
      const afterA = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      expect(afterA.currentRating).toBe(1500);
    });
  });

  describe('tickMatchTimeouts', () => {
    it('5分超のWAITING_APPROVALを自動承認する', async () => {
      const a = await createVeteranUser({ currentRating: 1500 });
      const b = await createVeteranUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id, {
        status: 'WAITING_APPROVAL',
        winnerId: a.id,
        reportedAt: new Date(Date.now() - AUTO_APPROVE_TIMEOUT_MS - 1000),
      });
      const result = await tickMatchTimeouts(testPrisma);
      expect(result.autoApproved).toHaveLength(1);
      const updated = await testPrisma.match.findUniqueOrThrow({ where: { id: m.id } });
      expect(updated.status).toBe('COMPLETED');
    });

    it('40分超のIN_PROGRESSをDRAWにする', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, {
        status: 'IN_PROGRESS',
        acceptedAt: new Date(Date.now() - DRAW_TIMEOUT_MS - 1000),
      });
      const result = await tickMatchTimeouts(testPrisma);
      expect(result.drawn).toHaveLength(1);
      const updated = await testPrisma.match.findUniqueOrThrow({ where: { id: m.id } });
      expect(updated.status).toBe('DRAW');
    });

    it('期限内の試合は変更されない', async () => {
      const a = await createUser();
      const b = await createUser();
      await createMatch(a.id, b.id, {
        status: 'WAITING_APPROVAL',
        winnerId: a.id,
        reportedAt: new Date(),
      });
      const result = await tickMatchTimeouts(testPrisma);
      expect(result.autoApproved).toHaveLength(0);
      expect(result.drawn).toHaveLength(0);
    });
  });
});
