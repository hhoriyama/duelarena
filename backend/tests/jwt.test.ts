import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt, isAdminDiscordId } from '../src/lib/jwt';

describe('JWT', () => {
  const payload = {
    userId: 'user-uuid-1',
    discordId: '123456789',
    isAdmin: false,
  };

  it('signJwt と verifyJwt が往復で同じpayloadを返す', () => {
    const token = signJwt(payload);
    expect(typeof token).toBe('string');
    const decoded = verifyJwt(token);
    expect(decoded).toEqual(payload);
  });

  it('改ざんされたトークンはnullを返す', () => {
    const token = signJwt(payload);
    const tampered = token.slice(0, -3) + 'xxx';
    expect(verifyJwt(tampered)).toBeNull();
  });

  it('不正な文字列はnullを返す', () => {
    expect(verifyJwt('not-a-jwt')).toBeNull();
    expect(verifyJwt('')).toBeNull();
  });

  it('isAdmin=trueのpayloadも往復できる', () => {
    const adminPayload = { ...payload, isAdmin: true };
    const token = signJwt(adminPayload);
    expect(verifyJwt(token)?.isAdmin).toBe(true);
  });
});

describe('isAdminDiscordId', () => {
  it('管理者IDリストに含まれていればtrue', () => {
    expect(isAdminDiscordId('111', ['111', '222'])).toBe(true);
  });

  it('含まれていなければfalse', () => {
    expect(isAdminDiscordId('999', ['111', '222'])).toBe(false);
  });

  it('空のリストではfalse', () => {
    expect(isAdminDiscordId('111', [])).toBe(false);
  });
});
