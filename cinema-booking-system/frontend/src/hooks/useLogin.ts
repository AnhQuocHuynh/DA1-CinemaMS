import { useCallback } from 'react';
import { authService } from '../services/authService';

export const useLogin = () => {
  const login = useCallback(() => {
    authService.login();
  }, []);

  return { login };
};
