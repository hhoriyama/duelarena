import { Request, Response, NextFunction } from 'express';
import { verifyJwt, JwtPayload } from '../lib/jwt';

export interface AuthedRequest extends Request {
  auth?: JwtPayload;
}

const TOKEN_COOKIE = 'duel_arena_token';

export function getTokenFromRequest(req: Request): string | null {
  const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    TOKEN_COOKIE
  ];
  if (fromCookie) return fromCookie;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  req.auth = payload;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!req.auth.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export const TOKEN_COOKIE_NAME = TOKEN_COOKIE;
