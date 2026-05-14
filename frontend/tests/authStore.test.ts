import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../src/stores/authStore';
import type { UserPublic } from '../src/types/user';

const sampleUser: UserPublic = {
  id: 'user-1',
  discordId: '123',
  username: 'Taro',
  avatarUrl: 'https://example.com/a.png',
  currentRating: 1500,
  highestRating: 1500,
  wins: 0,
  losses: 0,
  draws: 0,
  averageStarRating: null,
  matchCount: 0,
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAdmin: false, isLoading: true });
  });

  it('初期状態は user=null / isAdmin=false / isLoading=true', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAdmin).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('setAuth でユーザー情報がセットされ、isLoadingがfalseになる', () => {
    useAuthStore.getState().setAuth(sampleUser, true);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(sampleUser);
    expect(state.isAdmin).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('clearAuth でユーザー情報がクリアされる', () => {
    useAuthStore.getState().setAuth(sampleUser, true);
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAdmin).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('setLoading でフラグだけが更新される', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
