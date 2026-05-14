import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { ApiError } from '../api/client';

/**
 * /api/users/me を叩いてユーザー情報を取得し、authStoreに反映するフック。
 *
 * 注意: 返却する `user` は useQuery の結果から直接読む。
 * Zustand ストアは useEffect 内で更新されるため、初回レンダリング時には
 * まだ反映されておらず、PrivateRoute がリダイレクトしてしまうため。
 */
export function useAuth() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const query = useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => getMe(signal),
  });

  useEffect(() => {
    if (query.data) {
      setAuth(query.data.user, query.data.isAdmin);
    } else if (query.error) {
      const status = (query.error as ApiError).status;
      if (status === 401) {
        clearAuth();
      }
    }
  }, [query.data, query.error, setAuth, clearAuth]);

  return {
    user: query.data?.user ?? null,
    isAdmin: query.data?.isAdmin ?? false,
    isLoading: query.isLoading,
    error: query.error,
  };
}
