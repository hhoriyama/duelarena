import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer,
  stopTestServer,
  connectClient,
  waitFor,
} from './helpers/socket-server';
import { resetDb, testPrisma } from './helpers/db';
import { createUser, createVeteranUser, createMatch } from './helpers/seed';

describe('sockets/match (integration)', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('match:accept', () => {
    it('両者承認で IN_PROGRESS の match:updated が両者に届く', async () => {
      const a = await createUser();
      const b = await createUser();
      const match = await createMatch(a.id, b.id);
      const sa = await connectClient({ userId: a.id, discordId: a.discordId });
      const sb = await connectClient({ userId: b.id, discordId: b.discordId });

      // a が承認
      sa.emit('match:accept', { matchId: match.id });
      await waitFor(sa, 'match:updated');

      // b が承認 → 双方に IN_PROGRESS の通知
      const upA = waitFor<{ status: string }>(sa, 'match:updated');
      const upB = waitFor<{ status: string }>(sb, 'match:updated');
      sb.emit('match:accept', { matchId: match.id });
      const [resA, resB] = await Promise.all([upA, upB]);
      expect(resA.status).toBe('IN_PROGRESS');
      expect(resB.status).toBe('IN_PROGRESS');

      sa.close();
      sb.close();
    });
  });

  describe('match:toss', () => {
    it('トスで双方に match:ended が届きレート反映', async () => {
      const a = await createUser({ currentRating: 1500 });
      const b = await createUser({ currentRating: 1500 });
      const match = await createMatch(a.id, b.id);
      const sa = await connectClient({ userId: a.id, discordId: a.discordId });
      const sb = await connectClient({ userId: b.id, discordId: b.discordId });

      const endedA = waitFor<{ outcome: string }>(sa, 'match:ended');
      const endedB = waitFor<{ outcome: string }>(sb, 'match:ended');
      sa.emit('match:toss', { matchId: match.id });
      const [resA, resB] = await Promise.all([endedA, endedB]);
      expect(resA.outcome).toBe('TOSSED');
      expect(resB.outcome).toBe('TOSSED');
      const updatedA = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      expect(updatedA.currentRating).toBe(1497);

      sa.close();
      sb.close();
    });
  });

  describe('match:report / match:approve', () => {
    it('片方が報告 → 相手が承認 → COMPLETED', async () => {
      const a = await createVeteranUser({ currentRating: 1500 });
      const b = await createVeteranUser({ currentRating: 1500 });
      const match = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const sa = await connectClient({ userId: a.id, discordId: a.discordId });
      const sb = await connectClient({ userId: b.id, discordId: b.discordId });

      sa.emit('match:report', { matchId: match.id, winnerId: a.id });
      await waitFor(sa, 'match:updated');

      const endedA = waitFor<{ outcome: string; winner: { id: string } }>(
        sa,
        'match:ended',
      );
      sb.emit('match:approve', { matchId: match.id });
      const ended = await endedA;
      expect(ended.outcome).toBe('APPROVED');
      expect(ended.winner.id).toBe(a.id);

      const winner = await testPrisma.user.findUniqueOrThrow({ where: { id: a.id } });
      expect(winner.currentRating).toBe(1516);

      sa.close();
      sb.close();
    });

    it('両者が一致報告 → 即 COMPLETED', async () => {
      const a = await createVeteranUser({ currentRating: 1500 });
      const b = await createVeteranUser({ currentRating: 1500 });
      const match = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const sa = await connectClient({ userId: a.id, discordId: a.discordId });
      const sb = await connectClient({ userId: b.id, discordId: b.discordId });

      sa.emit('match:report', { matchId: match.id, winnerId: a.id });
      await waitFor(sa, 'match:updated');

      const endedA = waitFor<{ outcome: string }>(sa, 'match:ended');
      const endedB = waitFor<{ outcome: string }>(sb, 'match:ended');
      sb.emit('match:report', { matchId: match.id, winnerId: a.id });
      const [resA, resB] = await Promise.all([endedA, endedB]);
      expect(resA.outcome).toBe('APPROVED');
      expect(resB.outcome).toBe('APPROVED');

      sa.close();
      sb.close();
    });

    it('両者が不一致報告 → DISPUTED', async () => {
      const a = await createUser();
      const b = await createUser();
      const match = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const sa = await connectClient({ userId: a.id, discordId: a.discordId });
      const sb = await connectClient({ userId: b.id, discordId: b.discordId });

      sa.emit('match:report', { matchId: match.id, winnerId: a.id });
      await waitFor(sa, 'match:updated');

      const updB = waitFor<{ status: string }>(sb, 'match:updated');
      sb.emit('match:report', { matchId: match.id, winnerId: b.id });
      const updated = await updB;
      expect(updated.status).toBe('DISPUTED');

      sa.close();
      sb.close();
    });

    it('自分の報告を自分で承認しようとするとエラー', async () => {
      const a = await createUser();
      const b = await createUser();
      const match = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const sa = await connectClient({ userId: a.id, discordId: a.discordId });

      sa.emit('match:report', { matchId: match.id, winnerId: a.id });
      await waitFor(sa, 'match:updated');

      const errP = waitFor<{ message: string }>(sa, 'match:error');
      sa.emit('match:approve', { matchId: match.id });
      const err = await errP;
      expect(err.message).toContain('自分');

      sa.close();
    });
  });

  describe('match:reject', () => {
    it('異議申し立てで DISPUTED に遷移', async () => {
      const a = await createUser();
      const b = await createUser();
      const match = await createMatch(a.id, b.id, { status: 'IN_PROGRESS' });
      const sa = await connectClient({ userId: a.id, discordId: a.discordId });
      const sb = await connectClient({ userId: b.id, discordId: b.discordId });

      sa.emit('match:report', { matchId: match.id, winnerId: a.id });
      await waitFor(sa, 'match:updated');

      const updB = waitFor<{ status: string }>(sb, 'match:updated');
      sb.emit('match:reject', { matchId: match.id, description: '異議あり' });
      const upd = await updB;
      expect(upd.status).toBe('DISPUTED');

      sa.close();
      sb.close();
    });
  });
});
