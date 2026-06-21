import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { LoginFormData } from '../types/auth';

export const useLogin = () => {
  const navigate = useNavigate();
  const { setUser, setToken, setIsLoading, setError } = useAuthStore();

  const login = useCallback(
    async (credentials: LoginFormData) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authService.login(credentials);
        setUser(response.user);
        setToken(response.token);

        // Navigate based on user role
        const role = response.user.role.toLowerCase();
        navigate(`/${role}/dashboard`);

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        setError({
          message: errorMessage,
          code: 'LOGIN_ERROR',
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, setUser, setToken, setIsLoading, setError]
  );

  return { login };
};
