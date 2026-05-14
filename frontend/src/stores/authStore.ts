import { create } from 'zustand';
import type { UserPublic } from '../types/user';

interface AuthState {
  user: UserPublic | null;
  isAdmin: boolean;
  isLoading: boolean;
  setAuth: (user: UserPublic, isAdmin: boolean) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAdmin: false,
  isLoading: true,
  setAuth: (user, isAdmin) => set({ user, isAdmin, isLoading: false }),
  clearAuth: () => set({ user: null, isAdmin: false, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
