import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { resetDb, testPrisma } from './helpers/db';
import { createUser } from './helpers/seed';

const app = createApp();

describe('routes/auth - Discord OAuth (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/auth/discord', () => {
    it('Discord 認可URLへリダイレクトし、state Cookie をセット', async () => {
      const res = await request(app).get('/api/auth/discord').redirects(0);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('discord.com/api/oauth2/authorize');
      expect(res.headers.location).toContain('scope=identify');
      // state cookie
      const cookies = res.headers['set-cookie'];
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const stateCookie = cookiesArr.find((c: string) =>
        c.startsWith('duel_arena_oauth_state='),
      );
      expect(stateCookie).toBeDefined();
    });
  });

  describe('GET /api/auth/discord/callback', () => {
    function mockDiscordApis(opts: {
      tokenOk?: boolean;
      userPayload?: Record<string, unknown>;
    }) {
      const tokenOk = opts.tokenOk ?? true;
      const userPayload = opts.userPayload ?? {
        id: '12345',
        username: 'TestUser',
        global_name: 'テストユーザー',
        avatar: 'abc',
      };
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes('oauth2/token')) {
          if (!tokenOk) {
            return new Response('invalid_grant', { status: 400 });
          }
          return new Response(
            JSON.stringify({
              access_token: 'AT',
              token_type: 'Bearer',
              expires_in: 604800,
              refresh_token: 'RT',
              scope: 'identify',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        if (u.includes('/users/@me')) {
          return new Response(JSON.stringify(userPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      });
    }

    it('正常コールバック：ユーザー upsert + JWT Cookie + フロントへリダイレクト', async () => {
      mockDiscordApis({});
      const state = 'test-state-abc';
      const res = await request(app)
        .get(`/api/auth/discord/callback?code=test-code&state=${state}`)
        .set('Cookie', `duel_arena_oauth_state=${state}`)
        .redirects(0);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/success');

      // JWT cookie がセットされた
      const cookies = res.headers['set-cookie'];
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const tokenCookie = cookiesArr.find((c: string) =>
        c.startsWith('duel_arena_token='),
      );
      expect(tokenCookie).toBeDefined();

      // ユーザーが作成された
      const user = await testPrisma.user.findUnique({
        where: { discordId: '12345' },
      });
      expect(user).not.toBeNull();
      expect(user?.username).toBe('テストユーザー');
    });

    it('既存ユーザーは upsert で username/avatar が更新される', async () => {
      const existing = await createUser({
        discordId: '12345',
        username: '旧ユーザー名',
      });
      mockDiscordApis({});
      const state = 'test-state';
      await request(app)
        .get(`/api/auth/discord/callback?code=test-code&state=${state}`)
        .set('Cookie', `duel_arena_oauth_state=${state}`)
        .redirects(0);

      const updated = await testPrisma.user.findUniqueOrThrow({
        where: { id: existing.id },
      });
      expect(updated.username).toBe('テストユーザー');
    });

    it('state不一致は400', async () => {
      mockDiscordApis({});
      const res = await request(app)
        .get('/api/auth/discord/callback?code=c&state=expected')
        .set('Cookie', 'duel_arena_oauth_state=different')
        .redirects(0);
      expect(res.status).toBe(400);
    });

    it('code無しは400', async () => {
      const res = await request(app)
        .get('/api/auth/discord/callback?state=x')
        .set('Cookie', 'duel_arena_oauth_state=x')
        .redirects(0);
      expect(res.status).toBe(400);
    });

    it('Discord API失敗時はエラー画面へリダイレクト', async () => {
      mockDiscordApis({ tokenOk: false });
      const state = 's';
      const res = await request(app)
        .get(`/api/auth/discord/callback?code=c&state=${state}`)
        .set('Cookie', `duel_arena_oauth_state=${state}`)
        .redirects(0);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/error');
    });

    it('BAN中ユーザーは403', async () => {
      await createUser({ discordId: '12345', isBanned: true });
      mockDiscordApis({});
      const state = 's';
      const res = await request(app)
        .get(`/api/auth/discord/callback?code=c&state=${state}`)
        .set('Cookie', `duel_arena_oauth_state=${state}`)
        .redirects(0);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('JWT Cookieをクリアする', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const cleared = cookiesArr.find((c: string) =>
        c.startsWith('duel_arena_token=;'),
      );
      expect(cleared).toBeDefined();
    });
  });
});
