import { env } from '../config/env';

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  email?: string;
}

const DISCORD_API = 'https://discord.com/api';

/**
 * 認可コードをアクセストークンに交換する
 */
export async function exchangeCode(
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscordTokenResponse> {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new Error('Discord credentials not configured');
  }

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.DISCORD_REDIRECT_URI,
  });

  const res = await fetchImpl(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as DiscordTokenResponse;
}

/**
 * アクセストークンでユーザー情報を取得する
 */
export async function fetchDiscordUser(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscordUser> {
  const res = await fetchImpl(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Discord user: ${res.status}`);
  }
  return (await res.json()) as DiscordUser;
}

/**
 * Discordログインの認可URLを生成する
 */
export function buildAuthorizeUrl(state: string): string {
  if (!env.DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_CLIENT_ID not configured');
  }
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  return `${DISCORD_API}/oauth2/authorize?${params.toString()}`;
}

/**
 * Discordユーザー情報からアバターURLを構築する
 */
export function buildAvatarUrl(user: DiscordUser): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  // デフォルトアバター
  const idx = (BigInt(user.id) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

/**
 * Discordユーザーから表示名を取得する
 */
export function getDisplayName(user: DiscordUser): string {
  return user.global_name ?? user.username;
}
