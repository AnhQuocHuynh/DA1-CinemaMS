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

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: {
    id: string | number;
    email: string;
    role: 'USER' | 'ADMIN' | 'STAFF';
  };
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

export interface BackendAuthResponse {
  accessToken: string;
  tokenType: string;
  refreshToken?: string;
  user?: {
    id: number;
    email: string;
    fullName?: string;
    phone?: string;
    roles?: string[];
  };
}

export interface AuthError {
  message: string;
  code?: string;
}
