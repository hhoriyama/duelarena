import { describe, it, expect, beforeEach } from 'vitest';
import { rateOpponent } from '../../src/services/star-rating-service';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createMatch } from './helpers/seed';

describe('star-rating-service (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('COMPLETEDの試合で評価が作成され、相手の平均が更新される', async () => {
    const a = await createUser();
    const b = await createUser({ averageStarRating: null });
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    const result = await rateOpponent(testPrisma, m.id, a.id, 4);
    expect(result.ratedId).toBe(b.id);
    expect(result.newAverage).toBe(4);

    const updatedB = await testPrisma.user.findUniqueOrThrow({ where: { id: b.id } });
    expect(updatedB.averageStarRating).toBe(4);
  });

  it('複数の評価で平均が正しく計算される', async () => {
    const target = await createUser();
    // 3人の評価者がそれぞれ評価
    const ratings = [4, 5, 3];
    for (const stars of ratings) {
      const rater = await createUser();
      const m = await createMatch(rater.id, target.id, {
        status: 'COMPLETED',
        winnerId: rater.id,
      });
      await rateOpponent(testPrisma, m.id, rater.id, stars);
    }
    const updated = await testPrisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(updated.averageStarRating).toBeCloseTo(4, 2);
  });

  it('同じ試合に2回評価できない', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    await rateOpponent(testPrisma, m.id, a.id, 4);
    await expect(rateOpponent(testPrisma, m.id, a.id, 5)).rejects.toThrow(/既に/);
  });

  it('参加者以外は評価できない', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    await expect(rateOpponent(testPrisma, m.id, c.id, 4)).rejects.toThrow(/参加者/);
  });

  it('進行中の試合は評価不可', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
    await expect(rateOpponent(testPrisma, m.id, a.id, 4)).rejects.toThrow();
  });

  it('1〜5以外の値は拒否される', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    await expect(rateOpponent(testPrisma, m.id, a.id, 0)).rejects.toThrow();
    await expect(rateOpponent(testPrisma, m.id, a.id, 6)).rejects.toThrow();
    await expect(rateOpponent(testPrisma, m.id, a.id, 3.5)).rejects.toThrow();
  });
});
