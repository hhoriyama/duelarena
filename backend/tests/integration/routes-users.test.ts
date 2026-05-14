import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDb } from './helpers/db';
import { createUser } from './helpers/seed';
import { authCookie } from './helpers/auth';

const app = createApp();

describe('routes/users (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('GET /api/users/me', () => {
    it('未認証は401', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    it('認証済みなら自分の情報を返す', async () => {
      const u = await createUser({ username: 'TestUser', currentRating: 1234 });
      const res = await request(app)
        .get('/api/users/me')
        .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId }));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(u.id);
      expect(res.body.user.username).toBe('TestUser');
      expect(res.body.user.currentRating).toBe(1234);
      expect(res.body.isAdmin).toBe(false);
    });

    it('管理者なら isAdmin=true', async () => {
      const u = await createUser();
      const res = await request(app)
        .get('/api/users/me')
        .set('Cookie', authCookie({ userId: u.id, discordId: u.discordId, isAdmin: true }));
      expect(res.body.isAdmin).toBe(true);
    });

    it('DBに存在しないユーザーIDのJWTでは404', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set(
          'Cookie',
          authCookie({
            userId: '00000000-0000-0000-0000-000000000000',
            discordId: 'ghost',
          }),
        );
      expect(res.status).toBe(404);
    });
  });
});
