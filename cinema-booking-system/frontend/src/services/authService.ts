import keycloak from '../lib/keycloak';
import { useAuthStore } from '../store/authStore';
import apiClient from '../lib/apiClient';

export const authService = {
  login: (): void => {
    keycloak.login({ redirectUri: `${window.location.origin}/auth/callback` });
  },

  register: (): void => {
    keycloak.register({ redirectUri: `${window.location.origin}/auth/callback` });
  },

  forgotPassword: (): void => {
    keycloak.login({ action: 'UPDATE_PASSWORD', redirectUri: `${window.location.origin}/` });
  },

  refreshToken: async (): Promise<string | null> => {
    try {
      const refreshed = await keycloak.updateToken(60);
      if (refreshed) useAuthStore.getState().setToken(keycloak.token!);
      return keycloak.token ?? null;
    } catch {
      authService.logout();
      return null;
    }
  },

  logout: (): void => {
    useAuthStore.getState().clearUser();
    keycloak.logout({ redirectUri: `${window.location.origin}/` });
  },

  isAuthenticated: (): boolean => keycloak.authenticated ?? false,
  getToken:        (): string | null => keycloak.token ?? null,

  getUserInfo: () => {
    if (!keycloak.tokenParsed) return null;
    const { sub, email, preferred_username, given_name, family_name, realm_access } =
      keycloak.tokenParsed;
    return { keycloakId: sub, email, username: preferred_username,
             firstName: given_name, lastName: family_name,
             roles: realm_access?.roles ?? [] };
  },
};

export default apiClient;
