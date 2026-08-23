import { create } from 'zustand';
import { AuthUser, AuthError } from '../types/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: AuthError | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: AuthError | null) => void;
  logout: () => void;
  reset: () => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, token: user?.token || null }),
  setToken: (token) => set({ token }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: () => set({ user: null, token: null, error: null }),
  reset: () => set({ user: null, token: null, isLoading: false, error: null }),
  clearUser: () => set({ user: null, token: null }),
}));
