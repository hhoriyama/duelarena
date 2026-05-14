import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateCurrentSeason,
  getSeasonLeaderboard,
  getMonthlyStats,
  endSeasonAndStartNew,
} from '../../src/services/season-service';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createMatch } from './helpers/seed';

describe('season-service (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('getOrCreateCurrentSeason', () => {
    it('初回はシーズン1を自動作成', async () => {
      const s = await getOrCreateCurrentSeason(testPrisma);
      expect(s.name).toBe('シーズン1');
      expect(s.isActive).toBe(true);
    });

    it('既存アクティブシーズンがあればそれを返す', async () => {
      const s1 = await getOrCreateCurrentSeason(testPrisma);
      const s2 = await getOrCreateCurrentSeason(testPrisma);
      expect(s2.id).toBe(s1.id);
    });
  });

  describe('getSeasonLeaderboard', () => {
    it('試合経験者のみがレート順で返る', async () => {
      const a = await createUser({ currentRating: 1700, matchCount: 5 });
      const b = await createUser({ currentRating: 1500, matchCount: 3 });
      const c = await createUser({ currentRating: 2000, matchCount: 0 }); // 未対戦
      const d = await createUser({ currentRating: 1900, matchCount: 1, isBanned: true });

      const lb = await getSeasonLeaderboard(testPrisma);
      const ids = lb.map((e) => e.user.id);
      expect(ids).toEqual([a.id, b.id]);
      expect(ids).not.toContain(c.id);
      expect(ids).not.toContain(d.id);
      expect(lb[0].rank).toBe(1);
      expect(lb[1].rank).toBe(2);
    });
  });

  describe('getMonthlyStats', () => {
    it('指定月の最多勝利者を集計', async () => {
      const a = await createUser();
      const b = await createUser();
      const ended = new Date(Date.UTC(2026, 4, 15, 12, 0, 0)); // 2026年5月
      await createMatch(a.id, b.id, {
        status: 'COMPLETED',
        winnerId: a.id,
        endedAt: ended,
      });
      await createMatch(a.id, b.id, {
        status: 'COMPLETED',
        winnerId: a.id,
        endedAt: ended,
      });
      await createMatch(a.id, b.id, {
        status: 'COMPLETED',
        winnerId: b.id,
        endedAt: ended,
      });

      const stats = await getMonthlyStats(testPrisma, 2026, 5);
      expect(stats.yearMonth).toBe('2026-05');
      expect(stats.topWinners[0].user.id).toBe(a.id);
      expect(stats.topWinners[0].wins).toBe(2);
      expect(stats.topWinners[1].wins).toBe(1);
    });

    it('範囲外の試合はカウントしない', async () => {
      const a = await createUser();
      const b = await createUser();
      const wrongMonth = new Date(Date.UTC(2026, 5, 15, 12, 0, 0)); // 6月
      await createMatch(a.id, b.id, {
        status: 'COMPLETED',
        winnerId: a.id,
        endedAt: wrongMonth,
      });
      const stats = await getMonthlyStats(testPrisma, 2026, 5);
      expect(stats.topWinners).toHaveLength(0);
    });
  });

  describe('endSeasonAndStartNew', () => {
    it('レートリセット + 称号付与 + 新シーズン作成', async () => {
      await getOrCreateCurrentSeason(testPrisma);
      // 10人作って試合経験を付ける
      const users = [];
      for (let i = 0; i < 10; i++) {
        users.push(
          await createUser({
            currentRating: 2000 - i * 50,
            matchCount: 10,
            wins: 5,
          }),
        );
      }
      const result = await endSeasonAndStartNew(testPrisma);
      expect(result.endedSeason.isActive).toBe(false);
      expect(result.newSeason.isActive).toBe(true);
      expect(result.titlesGranted).toBeGreaterThan(0);

      // 全員のレートがリセット
      const after = await testPrisma.user.findMany();
      for (const u of after) {
        expect(u.currentRating).toBe(1500);
        expect(u.matchCount).toBe(0);
        expect(u.wins).toBe(0);
      }
      // 1位に王者称号
      const champion = await testPrisma.seasonTitle.findFirst({
        where: { rank: 1, userId: users[0].id },
      });
      expect(champion?.title).toContain('王者');
    });

    it('アクティブシーズンがない状態でendを呼ぶとエラー', async () => {
      await expect(endSeasonAndStartNew(testPrisma)).rejects.toThrow();
    });
  });
});
