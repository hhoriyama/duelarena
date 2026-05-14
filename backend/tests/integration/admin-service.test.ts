import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDashboardStats,
  searchUsers,
  banUser,
  unbanUser,
  adjustRating,
  listOpenDisputes,
  resolveDispute,
} from '../../src/services/admin-service';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createVeteranUser, createMatch } from './helpers/seed';

describe('admin-service (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('getDashboardStats', () => {
    it('各カウンタを返す', async () => {
      const u1 = await createUser({ matchCount: 1 });
      await createUser({ isBanned: true });
      await createMatch(u1.id, (await createUser()).id, { status: 'IN_PROGRESS' });
      const stats = await getDashboardStats(testPrisma);
      expect(stats.totalUsers).toBe(3);
      expect(stats.bannedUsers).toBe(1);
      expect(stats.matchesInProgress).toBe(1);
    });
  });

  describe('searchUsers', () => {
    it('ユーザー名で検索', async () => {
      await createUser({ username: 'Alice' });
      await createUser({ username: 'Bob' });
      const result = await searchUsers(testPrisma, 'ali');
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Alice');
    });

    it('Discord IDで検索', async () => {
      const u = await createUser({ discordId: '999888777' });
      const result = await searchUsers(testPrisma, '888');
      expect(result.map((r) => r.id)).toContain(u.id);
    });

    it('空文字は空配列', async () => {
      await createUser();
      const result = await searchUsers(testPrisma, '');
      expect(result).toEqual([]);
    });
  });

  describe('banUser / unbanUser', () => {
    it('BANでフラグが立ち、Ban履歴が記録される', async () => {
      const u = await createUser();
      await banUser(testPrisma, u.id, 'cheating', 'admin-discord');
      const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(updated.isBanned).toBe(true);
      const bans = await testPrisma.ban.findMany({ where: { userId: u.id } });
      expect(bans).toHaveLength(1);
      expect(bans[0].reason).toBe('cheating');
    });

    it('BANするとキューから外される', async () => {
      const u = await createUser();
      await testPrisma.queueEntry.create({
        data: { userId: u.id, ratingAtEntry: 1500, socketId: 's' },
      });
      await banUser(testPrisma, u.id, 'cheating', 'admin');
      expect(await testPrisma.queueEntry.count({ where: { userId: u.id } })).toBe(0);
    });

    it('BAN解除でフラグが下がる', async () => {
      const u = await createUser({ isBanned: true });
      await unbanUser(testPrisma, u.id);
      const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(updated.isBanned).toBe(false);
    });
  });

  describe('adjustRating', () => {
    it('レートを更新し履歴を記録する', async () => {
      const u = await createUser({ currentRating: 1500 });
      await adjustRating(testPrisma, u.id, 1800, '不正発覚による調整');
      const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(updated.currentRating).toBe(1800);
      expect(updated.highestRating).toBe(1800);
      const hist = await testPrisma.ratingHistory.findFirst({ where: { userId: u.id } });
      expect(hist?.reason).toBe('ADMIN_ADJUST');
      expect(hist?.delta).toBe(300);
    });

    it('減点でも highestRating は下がらない', async () => {
      const u = await createUser({ currentRating: 1700, highestRating: 1800 });
      await adjustRating(testPrisma, u.id, 1500, '減点');
      const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(updated.currentRating).toBe(1500);
      expect(updated.highestRating).toBe(1800);
    });

    it('負の値は拒否', async () => {
      const u = await createUser();
      await expect(adjustRating(testPrisma, u.id, -1, 'x')).rejects.toThrow();
    });
  });

  describe('listOpenDisputes / resolveDispute', () => {
    it('オープン中の紛争を返す', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
      await testPrisma.dispute.create({
        data: { matchId: m.id, raisedById: a.id, description: 'x', status: 'OPEN' },
      });
      const list = await listOpenDisputes(testPrisma);
      expect(list).toHaveLength(1);
      expect(list[0].player1.id).toBe(a.id);
    });

    it('勝者を確定するとEloが適用され COMPLETED に', async () => {
      const a = await createVeteranUser({ currentRating: 1500 });
      const b = await createVeteranUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
      const dispute = await testPrisma.dispute.create({
        data: { matchId: m.id, raisedById: a.id, description: 'x', status: 'OPEN' },
      });
      await resolveDispute(testPrisma, dispute.id, 'admin', { winnerId: a.id });
      const updated = await testPrisma.match.findUniqueOrThrow({ where: { id: m.id } });
      expect(updated.status).toBe('COMPLETED');
      const winner = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      expect(winner.currentRating).toBe(1516);
      expect(winner.wins).toBe(1);
    });

    it('cancel ですると CANCELLED になりレート変動なし', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1500 });
      const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
      const dispute = await testPrisma.dispute.create({
        data: { matchId: m.id, raisedById: a.id, description: 'x', status: 'OPEN' },
      });
      await resolveDispute(testPrisma, dispute.id, 'admin', { cancel: true });
      const updated = await testPrisma.match.findUniqueOrThrow({ where: { id: m.id } });
      expect(updated.status).toBe('CANCELLED');
      const afterA = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      expect(afterA.currentRating).toBe(1500);
    });

    it('既に裁定済みの紛争を再裁定するとエラー', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
      const dispute = await testPrisma.dispute.create({
        data: {
          matchId: m.id,
          raisedById: a.id,
          description: 'x',
          status: 'RESOLVED',
        },
      });
      await expect(
        resolveDispute(testPrisma, dispute.id, 'admin', { winnerId: a.id }),
      ).rejects.toThrow(/裁定済み/);
    });
  });
});
