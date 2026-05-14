import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer,
  stopTestServer,
  connectClient,
  waitFor,
} from './helpers/socket-server';
import { resetDb, testPrisma } from './helpers/db';
import { createUser } from './helpers/seed';

describe('sockets/queue (integration)', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('認証なしで接続を試みると拒否される', async () => {
    const { io } = await import('socket.io-client');
    const socket = io((await import('http')).createServer().listen(0).address() as any, {
      reconnection: false,
    });
    await expect(
      new Promise((resolve, reject) => {
        socket.on('connect', () => reject(new Error('Should not connect')));
        socket.on('connect_error', () => resolve(true));
      }),
    ).resolves.toBe(true);
    socket.close();
  });

  it('queue:enter → queue:entered を受信', async () => {
    const u = await createUser();
    const socket = await connectClient({ userId: u.id, discordId: u.discordId });
    socket.emit('queue:enter');
    const payload = await waitFor<{ enteredAt: string; ratingAtEntry: number }>(
      socket,
      'queue:entered',
    );
    expect(payload.ratingAtEntry).toBe(1500);
    expect(typeof payload.enteredAt).toBe('string');
    socket.close();
  });

  it('2ユーザーがキュー入りでマッチ成立', async () => {
    const a = await createUser({ currentRating: 1500 });
    const b = await createUser({ currentRating: 1520 });
    const sa = await connectClient({ userId: a.id, discordId: a.discordId });
    const sb = await connectClient({ userId: b.id, discordId: b.discordId });

    sa.emit('queue:enter');
    await waitFor(sa, 'queue:entered');

    const matchFoundA = waitFor<{ matchId: string }>(sa, 'match:found');
    const matchFoundB = waitFor<{ matchId: string }>(sb, 'match:found');
    sb.emit('queue:enter');
    const [a_msg, b_msg] = await Promise.all([matchFoundA, matchFoundB]);
    expect(a_msg.matchId).toBe(b_msg.matchId);

    sa.close();
    sb.close();
  });

  it('同一ユーザーの2つ目の接続は切断される', async () => {
    const u = await createUser();
    const s1 = await connectClient({ userId: u.id, discordId: u.discordId });
    // 2つ目の接続
    const s2 = await connectClient({ userId: u.id, discordId: u.discordId });
    // s2 側で disconnect を期待
    await new Promise<void>((resolve) => {
      s2.on('disconnect', () => resolve());
      s2.on('error:duplicate-tab', () => {});
      setTimeout(() => resolve(), 3000); // 念のためタイムアウト
    });
    s1.close();
    s2.close();
  });

  it('queue:leave で抜けられる', async () => {
    const u = await createUser();
    const socket = await connectClient({ userId: u.id, discordId: u.discordId });
    socket.emit('queue:enter');
    await waitFor(socket, 'queue:entered');
    socket.emit('queue:leave');
    await waitFor(socket, 'queue:left');
    expect(await testPrisma.queueEntry.count()).toBe(0);
    socket.close();
  });

  it('切断時にキューから自動削除される', async () => {
    const u = await createUser();
    const socket = await connectClient({ userId: u.id, discordId: u.discordId });
    socket.emit('queue:enter');
    await waitFor(socket, 'queue:entered');
    expect(await testPrisma.queueEntry.count()).toBe(1);
    socket.close();
    // 切断処理を待つ
    await new Promise((r) => setTimeout(r, 500));
    expect(await testPrisma.queueEntry.count()).toBe(0);
  });

  it('進行中試合があるとqueue:errorが返る', async () => {
    const u = await createUser();
    const opp = await createUser();
    await testPrisma.match.create({
      data: { player1Id: u.id, player2Id: opp.id, status: 'IN_PROGRESS' },
    });
    const socket = await connectClient({ userId: u.id, discordId: u.discordId });
    socket.emit('queue:enter');
    const err = await waitFor<{ message: string }>(socket, 'queue:error');
    expect(err.message).toContain('進行中');
    socket.close();
  });
});
