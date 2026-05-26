import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { ApiResponse, BackendAuthResponse, LoginFormData, LoginResponse } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<ApiResponse<BackendAuthResponse>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const payload = response.data?.data;

    if (!payload?.accessToken) {
      return null;
    }

    localStorage.setItem('authToken', payload.accessToken);
    if (payload.refreshToken) {
      localStorage.setItem('refreshToken', payload.refreshToken);
    }

    return payload.accessToken;
  } catch {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
};

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const newToken = await refreshAccessToken();

    if (!newToken) {
      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(originalRequest);
  }
);

export const authService = {
  login: async (credentials: LoginFormData): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<BackendAuthResponse>>('/auth/login', credentials);
    const payload = response.data?.data;

    if (!payload?.accessToken) {
      throw new Error('Login failed: missing access token');
    }

    const normalizedRole = (payload.user?.roles || [])
      .map((role) => role.replace('ROLE_', ''))
      .find((role) => role === 'ADMIN' || role === 'STAFF' || role === 'CUSTOMER');

    const role: LoginResponse['user']['role'] = normalizedRole === 'ADMIN'
      ? 'ADMIN'
      : normalizedRole === 'STAFF'
      ? 'STAFF'
      : 'USER';

    const loginResponse: LoginResponse = {
      token: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: {
        id: payload.user?.id ?? 'unknown',
        email: payload.user?.email ?? credentials.email,
        role,
      },
    };

    localStorage.setItem('authToken', loginResponse.token);
    if (loginResponse.refreshToken) {
      localStorage.setItem('refreshToken', loginResponse.refreshToken);
    }

    return loginResponse;
  },

  refreshToken: async (): Promise<string | null> => {
    return refreshAccessToken();
  },

  logout: async (): Promise<void> => {
    console.log('🔓 [AUTH] Logout');
    const refreshToken = localStorage.getItem('refreshToken');

    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch (error) {
        console.warn('Logout request failed. Clearing local tokens anyway.', error);
      }
    }

    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('authToken');
  },

  getToken: (): string | null => {
    return localStorage.getItem('authToken');
  },
};

export default apiClient;
