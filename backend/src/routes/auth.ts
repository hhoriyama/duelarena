import { Router } from 'express';
import crypto from 'crypto';
import { env, isProduction } from '../config/env';
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordUser,
} from '../services/discord-oauth';
import { upsertUserFromDiscord } from '../services/user-service';
import { signJwt, isAdminDiscordId } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { TOKEN_COOKIE_NAME } from '../middleware/auth';

const router = Router();

const STATE_COOKIE = 'duel_arena_oauth_state';

/**
 * GET /api/auth/discord
 *   Discord 認可ページへリダイレクト
 */
router.get('/discord', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(buildAuthorizeUrl(state));
});

/**
 * GET /api/auth/discord/callback
 *   認可コードを受け取りトークン交換、JWT発行
 */
router.get('/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookieState = (req as { cookies?: Record<string, string> }).cookies?.[
      STATE_COOKIE
    ];

    if (typeof code !== 'string' || typeof state !== 'string') {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }
    if (!cookieState || cookieState !== state) {
      res.status(400).json({ error: 'Invalid state' });
      return;
    }

    const token = await exchangeCode(code);
    const discordUser = await fetchDiscordUser(token.access_token);
    const user = await upsertUserFromDiscord(prisma, discordUser);

    if (user.isBanned) {
      res.status(403).json({ error: 'User is banned' });
      return;
    }

    const isAdmin = isAdminDiscordId(user.discordId, env.ADMIN_DISCORD_IDS);
    const jwt = signJwt({
      userId: user.id,
      discordId: user.discordId,
      isAdmin,
    });

    res.cookie(TOKEN_COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.clearCookie(STATE_COOKIE);

    res.redirect(`${env.FRONTEND_URL}/auth/success`);
  } catch (err) {
    console.error('[auth/callback]', err);
    res.redirect(`${env.FRONTEND_URL}/auth/error`);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (_req, res) => {
  res.clearCookie(TOKEN_COOKIE_NAME);
  res.json({ ok: true });
});

export default router;
