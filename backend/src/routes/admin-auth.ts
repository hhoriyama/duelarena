import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { signJwt, verifyJwt } from '../lib/jwt';
import { getTokenFromRequest, TOKEN_COOKIE_NAME } from '../middleware/auth';

/**
 * Web管理画面用のパスワード認証。
 *
 * - `POST /login` … env.ADMIN_PASSWORD と照合し、管理者JWT（isAdmin:true）を
 *   既存の認証クッキーに載せる。以降 /api/admin/* は既存の requireAuth+requireAdmin で通る。
 * - インメモリの試行回数制限つき（IPごとに15分で5回）。
 */
const router = Router();

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12時間
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(ip: string): boolean {
  const a = attempts.get(ip);
  return Boolean(a && Date.now() <= a.resetAt && a.count >= MAX_ATTEMPTS);
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now > a.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    a.count += 1;
  }
}

/** タイミング攻撃を避ける定数時間比較。 */
function passwordMatches(input: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

router.post('/login', (req: Request, res: Response) => {
  if (!env.ADMIN_PASSWORD) {
    res.status(503).json({ error: '管理者ログインは設定されていません（ADMIN_PASSWORD 未設定）' });
    return;
  }
  const ip = req.ip ?? 'unknown';
  if (tooManyAttempts(ip)) {
    res.status(429).json({ error: '試行回数の上限に達しました。15分後に再度お試しください' });
    return;
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !passwordMatches(password, env.ADMIN_PASSWORD)) {
    recordFailure(ip);
    res.status(401).json({ error: 'パスワードが違います' });
    return;
  }
  attempts.delete(ip);

  const token = signJwt({ userId: 'web-admin', discordId: 'web-admin', isAdmin: true });
  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    // 自宅PC(localhost, http)運用のため false。公開HTTPS化の際に true へ。
    secure: false,
    maxAge: SESSION_MAX_AGE_MS,
  });
  res.json({ ok: true });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(TOKEN_COOKIE_NAME);
  res.json({ ok: true });
});

/** フロントのセッション確認用。 */
router.get('/me', (req: Request, res: Response) => {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyJwt(token) : null;
  res.json({ admin: Boolean(payload?.isAdmin) });
});

export default router;
