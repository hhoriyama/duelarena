import { describe, it, expect, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import {
  requireAuth,
  requireAdmin,
  getTokenFromRequest,
  AuthedRequest,
} from '../src/middleware/auth';
import { signJwt } from '../src/lib/jwt';

function makeMockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(obj: unknown) {
      this.body = obj;
      return this;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

describe('getTokenFromRequest', () => {
  it('Cookieからトークンを取り出す', () => {
    const req = {
      cookies: { duel_arena_token: 'cookie-token' },
      headers: {},
    } as unknown as AuthedRequest;
    expect(getTokenFromRequest(req)).toBe('cookie-token');
  });

  it('Authorizationヘッダからも取り出せる', () => {
    const req = {
      cookies: {},
      headers: { authorization: 'Bearer header-token' },
    } as unknown as AuthedRequest;
    expect(getTokenFromRequest(req)).toBe('header-token');
  });

  it('どちらもなければnull', () => {
    const req = { cookies: {}, headers: {} } as unknown as AuthedRequest;
    expect(getTokenFromRequest(req)).toBeNull();
  });
});

describe('requireAuth', () => {
  it('トークンがなければ401', () => {
    const req = { cookies: {}, headers: {} } as unknown as AuthedRequest;
    const res = makeMockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('不正トークンなら401', () => {
    const req = {
      cookies: { duel_arena_token: 'bogus' },
      headers: {},
    } as unknown as AuthedRequest;
    const res = makeMockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('有効トークンならnext()が呼ばれ、req.authが設定される', () => {
    const token = signJwt({ userId: 'u1', discordId: 'd1', isAdmin: false });
    const req = {
      cookies: { duel_arena_token: token },
      headers: {},
    } as unknown as AuthedRequest;
    const res = makeMockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth?.userId).toBe('u1');
  });
});

describe('requireAdmin', () => {
  it('req.authが無ければ401', () => {
    const req = {} as unknown as AuthedRequest;
    const res = makeMockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('一般ユーザーは403', () => {
    const req = {
      auth: { userId: 'u1', discordId: 'd1', isAdmin: false },
    } as unknown as AuthedRequest;
    const res = makeMockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('管理者ならnext()', () => {
    const req = {
      auth: { userId: 'u1', discordId: 'd1', isAdmin: true },
    } as unknown as AuthedRequest;
    const res = makeMockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
