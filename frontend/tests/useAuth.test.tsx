import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '../src/hooks/useAuth';
import { useAuthStore } from '../src/stores/authStore';
import * as authApi from '../src/api/auth';
import { ApiError } from '../src/api/client';

vi.mock('../src/api/auth', () => ({
  getMe: vi.fn(),
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const sampleResponse = {
  user: {
    id: 'u1',
    discordId: '123',
    username: 'Taro',
    avatarUrl: 'a.png',
    currentRating: 1500,
    highestRating: 1500,
    wins: 0,
    losses: 0,
    draws: 0,
    averageStarRating: null,
    matchCount: 0,
  },
  isAdmin: false,
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.mocked(authApi.getMe).mockReset();
    useAuthStore.setState({ user: null, isAdmin: false, isLoading: true });
  });

  it('成功時に user と isAdmin を query.data から直接返す', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(sampleResponse);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });
    expect(result.current.user?.username).toBe('Taro');
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('isAdmin=true もそのまま返る', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ ...sampleResponse, isAdmin: true });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
    });
  });

  it('成功後に authStore にも反映される', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(sampleResponse);
    renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(useAuthStore.getState().user).not.toBeNull();
    });
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('401エラー時に authStore がクリアされる', async () => {
    useAuthStore.setState({ user: sampleResponse.user, isAdmin: false, isLoading: false });
    const apiError = new ApiError('Unauthorized', 401, {});
    vi.mocked(authApi.getMe).mockRejectedValue(apiError);
    renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  it('エラー時の user は null', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new ApiError('Unauthorized', 401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBeNull();
  });
});
