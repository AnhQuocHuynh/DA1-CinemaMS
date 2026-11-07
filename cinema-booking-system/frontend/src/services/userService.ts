import apiClient from '../lib/apiClient';

export interface UserProfile {
  id: number;          // internal Long ID (user_profile_db)
  keycloakId: string;  // Keycloak UUID (sub claim)
  email: string;
  fullName: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  avatarUrl?: string;
  active: boolean;
  roles?: string[];
}

export const userService = {
  getMyProfile: () =>
    apiClient.get<{ success: boolean; data: UserProfile }>('/users/me').then(r => r.data?.data),

  updateMyProfile: (data: Partial<UserProfile>) =>
    apiClient.put<{ success: boolean; data: UserProfile }>('/users/me', data).then(r => r.data?.data),
};
