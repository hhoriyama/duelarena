import { describe, it, expect, vi } from 'vitest';
import {
  buildAvatarUrl,
  getDisplayName,
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordUser,
  type DiscordUser,
} from '../src/services/discord-oauth';

describe('buildAvatarUrl', () => {
  it('avatar が設定されていれば CDN URL を返す', () => {
    const user: DiscordUser = {
      id: '123',
      username: 'taro',
      global_name: null,
      avatar: 'abc123',
    };
    expect(buildAvatarUrl(user)).toBe(
      'https://cdn.discordapp.com/avatars/123/abc123.png',
    );
  });

  it('avatar が null ならデフォルトアバター URL を返す', () => {
    const user: DiscordUser = {
      id: '123456789012345678',
      username: 'taro',
      global_name: null,
      avatar: null,
    };
    const url = buildAvatarUrl(user);
    expect(url).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
  });
});

describe('getDisplayName', () => {
  it('global_nameがあればそれを返す', () => {
    expect(
      getDisplayName({
        id: '1',
        username: 'old_name',
        global_name: 'New Name',
        avatar: null,
      }),
    ).toBe('New Name');
  });

  it('global_nameがnullならusernameを返す', () => {
    expect(
      getDisplayName({
        id: '1',
        username: 'taro',
        global_name: null,
        avatar: null,
      }),
    ).toBe('taro');
  });
});

describe('buildAuthorizeUrl', () => {
  it('stateとscopeが含まれた認可URLを返す', () => {
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    // env.tsはモジュールロード時に評価されるため、テストではここで設定
    const url = buildAuthorizeUrl('random-state-string');
    expect(url).toContain('discord.com/api/oauth2/authorize');
    expect(url).toContain('state=random-state-string');
    expect(url).toContain('scope=identify');
    expect(url).toContain('response_type=code');
  });
});

describe('exchangeCode', () => {
  it('Discord APIに対して正しいパラメータでPOSTする', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: 'AT',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'RT',
        scope: 'identify',
      }),
    })) as unknown as typeof fetch;

    const result = await exchangeCode('the-code', fakeFetch);
    expect(result.access_token).toBe('AT');
    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = (fakeFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://discord.com/api/oauth2/token');
    expect(init.method).toBe('POST');
    expect(init.body).toContain('code=the-code');
    expect(init.body).toContain('grant_type=authorization_code');
  });

  it('レスポンスがNGならエラーを投げる', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    })) as unknown as typeof fetch;

    await expect(exchangeCode('bad', fakeFetch)).rejects.toThrow(/Discord token exchange failed/);
  });
});

describe('fetchDiscordUser', () => {
  it('Authorization ヘッダ付きでGETする', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: '999',
        username: 'taro',
        global_name: 'Taro',
        avatar: null,
      }),
    })) as unknown as typeof fetch;

    const user = await fetchDiscordUser('AT', fakeFetch);
    expect(user.id).toBe('999');
    const [url, init] = (fakeFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://discord.com/api/users/@me');
    expect(init.headers.Authorization).toBe('Bearer AT');
  });
});
