import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createMatch } from './helpers/seed';
import { authCookie } from './helpers/auth';

const app = createApp();

describe('routes/seasons (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('未認証は401', async () => {
    const res = await request(app).get('/api/seasons/current');
    expect(res.status).toBe(401);
  });

  it('現シーズンを取得（初回は自動シード）', async () => {
    const u = await createUser();
    const res = await request(app)
      .get('/api/seasons/current')
      .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('シーズン1');
    expect(res.body.isActive).toBe(true);
  });

  it('リーダーボード取得', async () => {
    await createUser({ matchCount: 5, currentRating: 1700 });
    await createUser({ matchCount: 5, currentRating: 1600 });
    const u = await createUser();
    const res = await request(app)
      .get('/api/seasons/leaderboard?limit=10')
      .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries[0].rank).toBe(1);
  });

  it('月間統計取得', async () => {
    const a = await createUser();
    const b = await createUser();
    await createMatch(a.id, b.id, {
      status: 'COMPLETED',
      winnerId: a.id,
      endedAt: new Date(Date.UTC(2026, 4, 15)),
    });
    const u = await createUser();
    const res = await request(app)
      .get('/api/seasons/monthly?year=2026&month=5')
      .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
    expect(res.status).toBe(200);
    expect(res.body.yearMonth).toBe('2026-05');
  });

  it('不正な月は400', async () => {
    const u = await createUser();
    const res = await request(app)
      .get('/api/seasons/monthly?year=2026&month=13')
      .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
    expect(res.status).toBe(400);
  });

  it('自分の称号取得', async () => {
    const u = await createUser();
    const season = await testPrisma.season.create({
      data: {
        name: 'シーズンTest',
        startAt: new Date(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
        isActive: false,
      },
    });
    await testPrisma.seasonTitle.create({
      data: { seasonId: season.id, userId: u.id, rank: 1, title: 'シーズンTest王者' },
    });
    const res = await request(app)
      .get('/api/seasons/me/titles')
      .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
    expect(res.status).toBe(200);
    expect(res.body.titles).toHaveLength(1);
    expect(res.body.titles[0].title).toBe('シーズンTest王者');
  });
});
