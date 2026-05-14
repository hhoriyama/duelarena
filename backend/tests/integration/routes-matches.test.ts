import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createVeteranUser, createMatch } from './helpers/seed';
import { authCookie } from './helpers/auth';

const app = createApp();

describe('routes/matches (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('GET /api/matches/:id', () => {
    it('未認証なら401', async () => {
      const res = await request(app).get('/api/matches/abc');
      expect(res.status).toBe(401);
    });

    it('参加者は閲覧できる', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id);
      const res = await request(app)
        .get(`/api/matches/${m.id}`)
        .set('Cookie', authCookie({ userId: a.id, discordId: a.discordId }));
      expect(res.status).toBe(200);
      expect(res.body.match.id).toBe(m.id);
      expect(res.body.reports).toEqual([]);
    });

    it('第三者は403', async () => {
      const a = await createUser();
      const b = await createUser();
      const c = await createUser();
      const m = await createMatch(a.id, b.id);
      const res = await request(app)
        .get(`/api/matches/${m.id}`)
        .set('Cookie', authCookie({ userId: c.id, discordId: c.discordId }));
      expect(res.status).toBe(403);
    });

    it('管理者は他人の試合も閲覧できる', async () => {
      const a = await createUser();
      const b = await createUser();
      const admin = await createUser();
      const m = await createMatch(a.id, b.id);
      const res = await request(app)
        .get(`/api/matches/${m.id}`)
        .set(
          'Cookie',
          authCookie({ userId: admin.id, discordId: admin.discordId, isAdmin: true }),
        );
      expect(res.status).toBe(200);
    });

    it('存在しない試合は404', async () => {
      const u = await createUser();
      const res = await request(app)
        .get('/api/matches/00000000-0000-0000-0000-000000000000')
        .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/matches/me/history', () => {
    it('自分の完了済み試合のみ返す', async () => {
      const a = await createUser();
      const b = await createUser();
      const c = await createUser();
      await createMatch(a.id, b.id, {
        status: 'COMPLETED',
        winnerId: a.id,
        endedAt: new Date(),
      });
      await createMatch(b.id, c.id, {
        status: 'COMPLETED',
        winnerId: b.id,
        endedAt: new Date(),
      });
      await createMatch(a.id, c.id, { status: 'IN_PROGRESS' });
      const res = await request(app)
        .get('/api/matches/me/history')
        .set('Cookie', authCookie({ userId: a.id, discordId: a.discordId }));
      expect(res.status).toBe(200);
      expect(res.body.matches).toHaveLength(1);
      expect(res.body.matches[0].result).toBe('WIN');
    });
  });

  describe('GET /api/matches/me/active', () => {
    it('進行中の試合があればそのIDを返す', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const res = await request(app)
        .get('/api/matches/me/active')
        .set('Cookie', authCookie({ userId: a.id, discordId: a.discordId }));
      expect(res.body.matchId).toBe(m.id);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('進行中がなければ null', async () => {
      const u = await createUser();
      const res = await request(app)
        .get('/api/matches/me/active')
        .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
      expect(res.body.matchId).toBeNull();
    });
  });

  describe('POST /api/matches/:id/star-rating', () => {
    it('星評価が作成され平均が更新される', async () => {
      const a = await createVeteranUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
      const res = await request(app)
        .post(`/api/matches/${m.id}/star-rating`)
        .set('Cookie', authCookie({ userId: a.id, discordId: a.discordId }))
        .send({ stars: 5 });
      expect(res.status).toBe(200);
      const updatedB = await testPrisma.user.findUniqueOrThrow({ where: { id: b.id } });
      expect(updatedB.averageStarRating).toBe(5);
    });

    it('数値以外のstarsは400', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
      const res = await request(app)
        .post(`/api/matches/${m.id}/star-rating`)
        .set('Cookie', authCookie({ userId: a.id, discordId: a.discordId }))
        .send({ stars: 'five' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/matches/:id/report-user', () => {
    it('通報が作成される', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
      const res = await request(app)
        .post(`/api/matches/${m.id}/report-user`)
        .set('Cookie', authCookie({ userId: a.id, discordId: a.discordId }))
        .send({ category: 'CHEAT', description: 'チート行為', evidenceUrls: [] });
      expect(res.status).toBe(200);
      expect(await testPrisma.report.count()).toBe(1);
    });

    it('category 必須', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'COMPLETED', winnerId: a.id });
      const res = await request(app)
        .post(`/api/matches/${m.id}/report-user`)
        .set('Cookie', authCookie({ userId: a.id, discordId: a.discordId }))
        .send({ description: 'x' });
      expect(res.status).toBe(400);
    });
  });
});
