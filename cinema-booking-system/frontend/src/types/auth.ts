export interface LoginFormData {
  email: string;
  password: string;
}
  
export interface RegisterFormData {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}

export interface AuthUser {
  id: string;
  keycloakId: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'STAFF' | 'USER';
  token: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp?: number;
}

export interface ApiErrorResponse {
  message?: string;
  errorCode?: string;
  details?: unknown;
  timestamp?: number;
}

export interface AuthError {
  message: string;
  code?: string;
}
