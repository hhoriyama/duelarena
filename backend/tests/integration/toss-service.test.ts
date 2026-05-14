import { describe, it, expect, beforeEach } from 'vitest';
import { acceptMatch, tossMatch } from '../../src/services/toss-service';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createMatch } from './helpers/seed';

describe('toss-service (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('acceptMatch', () => {
    it('1人目の承認では IN_PROGRESS にならない', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id);
      const result = await acceptMatch(testPrisma, m.id, a.id);
      expect(result.bothAccepted).toBe(false);
      expect(result.match.status).toBe('PENDING_TOSS');
      expect(result.match.player1Accepted).toBe(true);
      expect(result.match.player2Accepted).toBe(false);
    });

    it('両者承認で IN_PROGRESS に遷移する', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id);
      await acceptMatch(testPrisma, m.id, a.id);
      const result = await acceptMatch(testPrisma, m.id, b.id);
      expect(result.bothAccepted).toBe(true);
      expect(result.match.status).toBe('IN_PROGRESS');
      expect(result.match.acceptedAt).not.toBeNull();
    });

    it('参加者以外は accept できない', async () => {
      const a = await createUser();
      const b = await createUser();
      const c = await createUser();
      const m = await createMatch(a.id, b.id);
      await expect(acceptMatch(testPrisma, m.id, c.id)).rejects.toThrow(/参加者/);
    });

    it('PENDING_TOSS 以外では accept できない', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await expect(acceptMatch(testPrisma, m.id, a.id)).rejects.toThrow(/IN_PROGRESS/);
    });
  });

  describe('tossMatch', () => {
    it('1回目のトスはトス側-3、受諾側+5', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id);
      const result = await tossMatch(testPrisma, m.id, a.id);
      expect(result.tosserDelta).toBe(-3);
      expect(result.receiverDelta).toBe(5);
      expect(result.tosser.currentRating).toBe(1497);
      expect(result.receiver.currentRating).toBe(1505);
      expect(result.match.status).toBe('COMPLETED');
      expect(result.match.tossById).toBe(a.id);
    });

    it('連続トスでペナルティが増える（-3 → -10 → -30 → -50）', async () => {
      const a = await createUser({ currentRating: 1500 });
      for (const expected of [-3, -10, -30, -50, -50]) {
        const opp = await createUser({ currentRating: 1500 });
        const m = await createMatch(a.id, opp.id);
        const r = await tossMatch(testPrisma, m.id, a.id);
        expect(r.tosserDelta).toBe(expected);
      }
      const final = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      // 5回連続トス: -3 -10 -30 -50 -50 = -143
      // ただしレートは0未満にならない (下限0)
      expect(final.consecutiveTossCount).toBe(5);
      expect(final.currentRating).toBe(Math.max(0, 1500 - 143));
    });

    it('受諾側の highestRating も更新される', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1500, highestRating: 1500 });
      const m = await createMatch(a.id, b.id);
      await tossMatch(testPrisma, m.id, a.id);
      const updatedB = await testPrisma.user.findUniqueOrThrow({ where: { id: b.id } });
      expect(updatedB.highestRating).toBe(1505);
    });

    it('レート履歴が両者分記録される', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id);
      await tossMatch(testPrisma, m.id, a.id);
      const histories = await testPrisma.ratingHistory.findMany({
        where: { matchId: m.id },
      });
      expect(histories).toHaveLength(2);
      expect(histories.find((h) => h.userId === a.id)?.reason).toBe('TOSS_PENALTY');
      expect(histories.find((h) => h.userId === b.id)?.reason).toBe('TOSS_RECEIVED');
    });

    it('PENDING_TOSS 以外ではトスできない', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await expect(tossMatch(testPrisma, m.id, a.id)).rejects.toThrow(/IN_PROGRESS/);
    });
  });
});
