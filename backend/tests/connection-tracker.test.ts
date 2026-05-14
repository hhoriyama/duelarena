import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionTracker } from '../src/sockets/connection-tracker';

describe('ConnectionTracker', () => {
  let t: ConnectionTracker;

  beforeEach(() => {
    t = new ConnectionTracker();
  });

  it('新規ユーザーの登録は成功する', () => {
    expect(t.register('u1', 's1')).toBe(true);
    expect(t.getSocketId('u1')).toBe('s1');
    expect(t.getUserId('s1')).toBe('u1');
    expect(t.size()).toBe(1);
  });

  it('同じユーザーが別ソケットで再登録するとブロックされる', () => {
    t.register('u1', 's1');
    expect(t.register('u1', 's2')).toBe(false);
    // s1 のままであること
    expect(t.getSocketId('u1')).toBe('s1');
    expect(t.size()).toBe(1);
  });

  it('同じソケットで再登録（再接続風）は成功する', () => {
    t.register('u1', 's1');
    expect(t.register('u1', 's1')).toBe(true);
  });

  it('異なるユーザー同士は同時に登録できる', () => {
    expect(t.register('u1', 's1')).toBe(true);
    expect(t.register('u2', 's2')).toBe(true);
    expect(t.size()).toBe(2);
  });

  it('unregister でエントリが削除される', () => {
    t.register('u1', 's1');
    expect(t.unregister('s1')).toBe('u1');
    expect(t.getSocketId('u1')).toBeNull();
    expect(t.getUserId('s1')).toBeNull();
    expect(t.size()).toBe(0);
  });

  it('unregister 後は再登録できる', () => {
    t.register('u1', 's1');
    t.unregister('s1');
    expect(t.register('u1', 's2')).toBe(true);
    expect(t.getSocketId('u1')).toBe('s2');
  });

  it('存在しないソケットの unregister は null を返す', () => {
    expect(t.unregister('nope')).toBeNull();
  });

  it('userToSocket と socketToUser の整合性が保たれる', () => {
    t.register('u1', 's1');
    t.unregister('s1');
    // 古いマッピングが残っていないこと
    expect(t.getUserId('s1')).toBeNull();
    expect(t.getSocketId('u1')).toBeNull();
  });
});
