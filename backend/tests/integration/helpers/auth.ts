import { signJwt } from '../../../src/lib/jwt';

/**
 * テスト用にJWT Cookieヘッダを生成する
 */
export function authCookie(opts: {
  userId: string;
  discordId: string;
  isAdmin?: boolean;
}): string {
  const token = signJwt({
    userId: opts.userId,
    discordId: opts.discordId,
    isAdmin: opts.isAdmin ?? false,
  });
  return `duel_arena_token=${token}`;
}
