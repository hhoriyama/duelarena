import { describe, it, expect, beforeEach } from 'vitest';
import { createReport } from '../../src/services/report-service';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createMatch } from './helpers/seed';

describe('report-service (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('COMPLETED の試合への通報が作成される', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    const result = await createReport(testPrisma, m.id, a.id, 'CHEAT', 'チート行為');
    const report = await testPrisma.report.findUniqueOrThrow({ where: { id: result.id } });
    expect(report.targetId).toBe(b.id);
    expect(report.category).toBe('CHEAT');
  });

  it('進行中の試合には通報できない', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
    await expect(
      createReport(testPrisma, m.id, a.id, 'CHEAT', 'x'),
    ).rejects.toThrow();
  });

  it('DISPUTED の試合には通報できる', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
    const result = await createReport(testPrisma, m.id, a.id, 'OTHER', 'detail');
    expect(result.id).toBeDefined();
  });

  it('参加者以外は通報できない', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    await expect(
      createReport(testPrisma, m.id, c.id, 'CHEAT', 'x'),
    ).rejects.toThrow(/参加者/);
  });

  it('説明文が長すぎると拒否', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    const longText = 'x'.repeat(2001);
    await expect(
      createReport(testPrisma, m.id, a.id, 'CHEAT', longText),
    ).rejects.toThrow(/2000/);
  });

  it('エビデンスURLが6件以上だと拒否', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    const urls = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.png`);
    await expect(
      createReport(testPrisma, m.id, a.id, 'CHEAT', 'x', urls),
    ).rejects.toThrow(/5件/);
  });

  it('同じ試合への重複通報は許容される（複数の問題を別々に通報できる）', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    await createReport(testPrisma, m.id, a.id, 'CHEAT', '不正1');
    await createReport(testPrisma, m.id, a.id, 'HARASSMENT', '不正2');
    expect(await testPrisma.report.count()).toBe(2);
  });

  it('不正なカテゴリは拒否', async () => {
    const a = await createUser();
    const b = await createUser();
    const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
    await expect(
      // @ts-expect-error 型を意図的に違反させる
      createReport(testPrisma, m.id, a.id, 'INVALID_CATEGORY', 'x'),
    ).rejects.toThrow();
  });
});
