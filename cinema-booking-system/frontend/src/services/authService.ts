import axios, { AxiosInstance } from 'axios';
import { LoginFormData, LoginResponse } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (credentials: LoginFormData): Promise<LoginResponse> => {
    // TODO: Uncomment for real implementation
    // const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    // if (response.data.token) {
    //   localStorage.setItem('authToken', response.data.token);
    // }
    // return response.data;

    console.log('🔐 [AUTH] Login attempt:', credentials);
    
    // Mock response for development
    const mockResponse: LoginResponse = {
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        email: credentials.email,
        role: credentials.email.includes('admin') ? 'ADMIN' : credentials.email.includes('staff') ? 'STAFF' : 'USER',
      },
    };
    
    localStorage.setItem('authToken', mockResponse.token);
    console.log('✅ [AUTH] Login successful:', mockResponse);
    return mockResponse;
  },

  logout: (): void => {
    console.log('🔓 [AUTH] Logout');
    localStorage.removeItem('authToken');
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('authToken');
  },

  getToken: (): string | null => {
    return localStorage.getItem('authToken');
  },
};

export default apiClient;
