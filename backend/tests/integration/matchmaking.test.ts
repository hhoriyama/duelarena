import { describe, it, expect, beforeEach } from 'vitest';
import {
  enterQueue,
  leaveQueue,
  getQueueState,
  tick,
} from '../../src/services/matchmaking';
import { testPrisma } from './helpers/db';
import { resetDb } from './helpers/db';
import { createUser, createMatch } from './helpers/seed';

describe('matchmaking service (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('enterQueue', () => {
    it('単独でキューに入ると待機状態になる', async () => {
      const u = await createUser({ currentRating: 1500 });
      const result = await enterQueue(testPrisma, u.id, 'socket-1');
      expect(result.matched).toBe(false);
      const entries = await testPrisma.queueEntry.findMany();
      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe(u.id);
    });

    it('既存ユーザーが2人入るとマッチング成立', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1520 });
      const r1 = await enterQueue(testPrisma, a.id, 'sa');
      expect(r1.matched).toBe(false);
      const r2 = await enterQueue(testPrisma, b.id, 'sb');
      expect(r2.matched).toBe(true);
      // キューは空に
      expect(await testPrisma.queueEntry.count()).toBe(0);
      // 試合が1件作成
      const matches = await testPrisma.match.findMany();
      expect(matches).toHaveLength(1);
      expect(matches[0].status).toBe('PENDING_TOSS');
    });

    it('レート差±100超ではマッチしない', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1700 });
      await enterQueue(testPrisma, a.id, 'sa');
      const r = await enterQueue(testPrisma, b.id, 'sb');
      expect(r.matched).toBe(false);
      expect(await testPrisma.queueEntry.count()).toBe(2);
    });

    it('連続対戦ブロック：直近の相手とは再マッチしない', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1500 });
      const match = await createMatch(a.id, b.id, { status: 'COMPLETED' });
      // 直近対戦相手を登録
      await testPrisma.recentOpponent.create({
        data: { userId: a.id, opponentId: b.id, matchId: match.id },
      });
      await testPrisma.recentOpponent.create({
        data: { userId: b.id, opponentId: a.id, matchId: match.id },
      });

      await enterQueue(testPrisma, a.id, 'sa');
      const r = await enterQueue(testPrisma, b.id, 'sb');
      expect(r.matched).toBe(false);
    });

    it('進行中の試合があるとキューに入れない', async () => {
      const a = await createUser();
      const b = await createUser();
      await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      await expect(enterQueue(testPrisma, a.id, 'sa')).rejects.toThrow(/進行中の試合/);
    });

    it('BAN中のユーザーはキューに入れない', async () => {
      const u = await createUser({ isBanned: true });
      await expect(enterQueue(testPrisma, u.id, 'sa')).rejects.toThrow(/banned/i);
    });

    it('idempotent: 既にキュー入りのユーザーが再エントリーしてもエラーにならない', async () => {
      const u = await createUser();
      const first = await enterQueue(testPrisma, u.id, 'old-socket');
      expect(first.matched).toBe(false);
      const second = await enterQueue(testPrisma, u.id, 'new-socket');
      expect(second.matched).toBe(false);
      // 同じ entered_at が保持され、socketIdだけ更新される
      const entry = await testPrisma.queueEntry.findUnique({
        where: { userId: u.id },
      });
      expect(entry?.socketId).toBe('new-socket');
      if (first.matched === false) {
        expect(entry?.enteredAt.getTime()).toBe(first.enteredAt.getTime());
      }
    });

    it('星評価が大きく離れた相手とはマッチしない', async () => {
      const a = await createUser({ currentRating: 1500, averageStarRating: 4.5 });
      const b = await createUser({ currentRating: 1500, averageStarRating: 2.0 });
      await enterQueue(testPrisma, a.id, 'sa');
      const r = await enterQueue(testPrisma, b.id, 'sb');
      expect(r.matched).toBe(false);
    });

    it('片方が未評価なら星評価フィルタは効かずマッチする', async () => {
      const a = await createUser({ currentRating: 1500, averageStarRating: 4.5 });
      const b = await createUser({ currentRating: 1500, averageStarRating: null });
      await enterQueue(testPrisma, a.id, 'sa');
      const r = await enterQueue(testPrisma, b.id, 'sb');
      expect(r.matched).toBe(true);
    });

    it('マッチ成立時に両プレイヤーの recent_opponents が記録される', async () => {
      const a = await createUser();
      const b = await createUser();
      await enterQueue(testPrisma, a.id, 'sa');
      await enterQueue(testPrisma, b.id, 'sb');
      const recents = await testPrisma.recentOpponent.findMany();
      expect(recents).toHaveLength(2);
      const userIds = recents.map((r) => r.userId).sort();
      expect(userIds).toEqual([a.id, b.id].sort());
    });
  });

  describe('leaveQueue', () => {
    it('キューから抜ける', async () => {
      const u = await createUser();
      await enterQueue(testPrisma, u.id, 'sa');
      await leaveQueue(testPrisma, u.id);
      expect(await testPrisma.queueEntry.count()).toBe(0);
    });

    it('キューに居ないユーザーへの leaveQueue はエラーにならない', async () => {
      const u = await createUser();
      await leaveQueue(testPrisma, u.id);
      expect(await testPrisma.queueEntry.count()).toBe(0);
    });
  });

  describe('getQueueState', () => {
    it('キュー内ユーザーは inQueue=true で詳細を返す', async () => {
      const u = await createUser({ currentRating: 1400 });
      await enterQueue(testPrisma, u.id, 'sa');
      const state = await getQueueState(testPrisma, u.id);
      expect(state.inQueue).toBe(true);
      expect(state.ratingAtEntry).toBe(1400);
      expect(state.currentRange).toBeGreaterThanOrEqual(100);
    });

    it('キューに居ないユーザーは inQueue=false', async () => {
      const u = await createUser();
      const state = await getQueueState(testPrisma, u.id);
      expect(state.inQueue).toBe(false);
    });
  });

  describe('tick', () => {
    it('5分超過のエントリを削除する', async () => {
      const u = await createUser();
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      await testPrisma.queueEntry.create({
        data: {
          userId: u.id,
          ratingAtEntry: 1500,
          enteredAt: sixMinutesAgo,
          socketId: 'sa',
        },
      });
      const result = await tick(testPrisma);
      expect(result.timedOutUserIds).toContain(u.id);
      expect(await testPrisma.queueEntry.count()).toBe(0);
    });

    it('待機中で許容範囲が拡張されてマッチ成立するケース', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1650 });
      // 範囲150に達するように2分前に投入
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
      await testPrisma.queueEntry.create({
        data: {
          userId: a.id,
          ratingAtEntry: 1500,
          enteredAt: twoMinAgo,
          socketId: 'sa',
        },
      });
      await testPrisma.queueEntry.create({
        data: {
          userId: b.id,
          ratingAtEntry: 1650,
          enteredAt: twoMinAgo,
          socketId: 'sb',
        },
      });
      const result = await tick(testPrisma);
      expect(result.matches).toHaveLength(1);
      expect(await testPrisma.queueEntry.count()).toBe(0);
    });
  });
});
