import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createVeteranUser, createMatch } from './helpers/seed';
import { authCookie } from './helpers/auth';

const app = createApp();

describe('routes/admin (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('認可', () => {
    it('未認証は401', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('一般ユーザーは403', async () => {
      const u = await createUser();
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
      expect(res.status).toBe(403);
    });

    it('管理者は200', async () => {
      const u = await createUser();
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId, isAdmin: true }));
      expect(res.status).toBe(200);
      expect(typeof res.body.totalUsers).toBe('number');
    });
  });

  describe('ユーザー管理', () => {
    let adminCookie: string;
    beforeEach(async () => {
      const admin = await createUser({ discordId: 'admin-1' });
      adminCookie = authCookie({
        userId: admin.id,
        discordId: admin.discordId,
        isAdmin: true,
      });
    });

    it('ユーザー検索', async () => {
      await createUser({ username: 'Alice' });
      const res = await request(app)
        .get('/api/admin/users/search?q=ali')
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.users[0].username).toBe('Alice');
    });

    it('BAN実行', async () => {
      const u = await createUser();
      const res = await request(app)
        .post(`/api/admin/users/${u.id}/ban`)
        .set('Cookie', adminCookie)
        .send({ reason: 'チート' });
      expect(res.status).toBe(200);
      expect(res.body.isBanned).toBe(true);
    });

    it('BAN解除', async () => {
      const u = await createUser({ isBanned: true });
      const res = await request(app)
        .post(`/api/admin/users/${u.id}/unban`)
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.isBanned).toBe(false);
    });

    it('レート調整', async () => {
      const u = await createUser({ currentRating: 1500 });
      const res = await request(app)
        .post(`/api/admin/users/${u.id}/adjust-rating`)
        .set('Cookie', adminCookie)
        .send({ rating: 2000, reason: '管理者調整' });
      expect(res.status).toBe(200);
      expect(res.body.user.currentRating).toBe(2000);
    });
  });

  describe('紛争裁定', () => {
    let adminCookie: string;
    beforeEach(async () => {
      const admin = await createUser({ discordId: 'admin-2' });
      adminCookie = authCookie({
        userId: admin.id,
        discordId: admin.discordId,
        isAdmin: true,
      });
    });

    it('オープン中の紛争一覧を取得', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
      await testPrisma.dispute.create({
        data: { matchId: m.id, raisedById: a.id, description: 'x', status: 'OPEN' },
      });
      const res = await request(app).get('/api/admin/disputes').set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.disputes).toHaveLength(1);
    });

    it('紛争を勝者確定で裁定', async () => {
      const a = await createVeteranUser();
      const b = await createVeteranUser();
      const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
      const dispute = await testPrisma.dispute.create({
        data: { matchId: m.id, raisedById: a.id, description: 'x', status: 'OPEN' },
      });
      const res = await request(app)
        .post(`/api/admin/disputes/${dispute.id}/resolve`)
        .set('Cookie', adminCookie)
        .send({ winnerId: a.id });
      expect(res.status).toBe(200);
      expect(res.body.matchStatus).toBe('COMPLETED');
    });

    it('紛争を試合無効化で裁定', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
      const dispute = await testPrisma.dispute.create({
        data: { matchId: m.id, raisedById: a.id, description: 'x', status: 'OPEN' },
      });
      const res = await request(app)
        .post(`/api/admin/disputes/${dispute.id}/resolve`)
        .set('Cookie', adminCookie)
        .send({ cancel: true });
      expect(res.status).toBe(200);
      expect(res.body.matchStatus).toBe('CANCELLED');
    });

    it('winnerIdもcancelも無い場合は400', async () => {
      const a = await createUser();
      const b = await createUser();
      const m = await createMatch(a.id, b.id, { status: 'DISPUTED' });
      const dispute = await testPrisma.dispute.create({
        data: { matchId: m.id, raisedById: a.id, description: 'x', status: 'OPEN' },
      });
      const res = await request(app)
        .post(`/api/admin/disputes/${dispute.id}/resolve`)
        .set('Cookie', adminCookie)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
