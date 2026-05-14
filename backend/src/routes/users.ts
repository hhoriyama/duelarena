import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { toUserPublic } from '../services/user-service';

const router = Router();

/**
 * GET /api/users/me
 *   現在ログイン中のユーザー情報を返す
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: toUserPublic(user), isAdmin: req.auth.isAdmin });
});

export default router;
