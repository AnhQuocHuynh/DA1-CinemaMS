import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import keycloak from './keycloak';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Inject Keycloak Bearer token; refresh proactively if < 30s remaining
apiClient.interceptors.request.use(async (config) => {
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch {
      keycloak.logout();
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }
    config.headers.Authorization = `Bearer ${keycloak.token}`;
  }
  return config;
});

// Handle 401 (force-refresh + retry once) and 403 (redirect home)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await keycloak.updateToken(-1);
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${keycloak.token}`,
        };
        return apiClient(originalRequest);
      } catch {
        keycloak.logout();
        return Promise.reject(error);
      }
    }
    if (error.response?.status === 403) {
      console.warn('[apiClient] 403 Forbidden:', error.config?.url);
      //redirect to home if user role is not admin (temp fix)
      if (!keycloak.hasRealmRole('ADMIN')) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
