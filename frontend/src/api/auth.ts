import { apiBaseUrl, apiFetch } from './client';
import type { MeResponse } from '../types/user';

/**
 * 現在ログイン中のユーザー情報を取得する
 */
export async function getMe(signal?: AbortSignal): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/users/me', { signal });
}

/**
 * ログアウト
 */
export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

/**
 * Discordログインのフルパスを返す（クライアントから直接遷移）
 */
export function getDiscordLoginUrl(): string {
  return `${apiBaseUrl}/api/auth/discord`;
}
