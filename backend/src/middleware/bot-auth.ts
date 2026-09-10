import { Request, Response, NextFunction } from 'express';
import type { User } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';

/**
 * Bot（duelarena-bot）専用の認証ミドルウェア。DESIGN.md §3。
 *
 * - `Authorization: Bearer <BOT_API_SECRET>` を検証（Bot自身の認証）。
 * - `X-Discord-Id` で「どのDiscordユーザーの操作か」を代理指定する。
 *   値が 'system' の場合は outbox 取得など個人に紐づかない操作用。
 */
export interface BotRequest extends Request {
  botDiscordId?: string;
  botUser?: User;
}

export function requireBotAuth(req: BotRequest, res: Response, next: NextFunction): void {
  if (!env.BOT_API_SECRET) {
    res.status(503).json({ error: 'Bot API is not configured' });
    return;
  }
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== env.BOT_API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const discordId = req.headers['x-discord-id'];
  if (typeof discordId !== 'string' || !discordId) {
    res.status(400).json({ error: 'X-Discord-Id header required' });
    return;
  }
  req.botDiscordId = discordId;
  next();
}

/** X-Discord-Id が管理者かどうか。 */
export function isBotAdmin(discordId: string): boolean {
  return env.ADMIN_DISCORD_IDS.includes(discordId);
}

/**
 * Discord ID からアプリユーザーを解決する。存在しなければ作成（自動登録）。
 * username/avatar はヘッダで渡されたものがあれば反映する。
 */
export async function resolveBotUser(req: BotRequest): Promise<User> {
  const discordId = req.botDiscordId as string;
  const username =
    (req.headers['x-discord-username'] as string | undefined) ?? discordId;
  const avatarUrl = (req.headers['x-discord-avatar'] as string | undefined) ?? '';

  const user = await prisma.user.upsert({
    where: { discordId },
    create: { discordId, username, avatarUrl },
    update: {},
  });
  req.botUser = user;
  return user;
}
