export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN' | 'STAFF';
  };
}

export interface AuthError {
  message: string;
  code?: string;
}
