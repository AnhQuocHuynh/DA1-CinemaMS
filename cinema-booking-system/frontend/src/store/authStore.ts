import { create } from 'zustand';
import { LoginResponse, AuthError } from '../types/auth';

interface AuthState {
  user: LoginResponse['user'] | null;
  token: string | null;
  isLoading: boolean;
  error: AuthError | null;

  // Actions
  setUser: (user: LoginResponse['user'] | null) => void;
  setToken: (token: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: AuthError | null) => void;
  logout: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('authToken'),
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
    set({ token });
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, error: null });
  },
  reset: () =>
    set({
      user: null,
      token: null,
      isLoading: false,
      error: null,
    }),
}));
