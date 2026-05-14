import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  discordId: string;
  isAdmin: boolean;
}

/**
 * JWTを発行する
 */
export function signJwt(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * JWTを検証してペイロードを返す。失敗時はnull。
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string') return null;
    const { userId, discordId, isAdmin } = decoded as Record<string, unknown>;
    if (
      typeof userId !== 'string' ||
      typeof discordId !== 'string' ||
      typeof isAdmin !== 'boolean'
    ) {
      return null;
    }
    return { userId, discordId, isAdmin };
  } catch {
    return null;
  }
}

/**
 * 管理者かどうかを判定する。
 */
export function isAdminDiscordId(discordId: string, adminIds: string[]): boolean {
  return adminIds.includes(discordId);
}
