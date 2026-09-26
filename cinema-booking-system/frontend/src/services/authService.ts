import keycloak from '../lib/keycloak';
import { useAuthStore } from '../store/authStore';
import apiClient from '../lib/apiClient';

export const authService = {
  login: async (options?: { redirectUri?: string; locale?: string; theme?: string }): Promise<void> => {
    const currentLang = options?.locale || localStorage.getItem('cinema_lang') || localStorage.getItem('i18nextLng') || localStorage.getItem('lang') || 'vi';
    const currentTheme = options?.theme || localStorage.getItem('cinema_theme') || 'system';

    const loginUrl = await keycloak.createLoginUrl({
      redirectUri: options?.redirectUri || `${window.location.origin}/auth/callback`,
      locale: currentLang,
    });
    window.location.assign(`${loginUrl}&theme=${encodeURIComponent(currentTheme)}`);
  },

  register: async (options?: { redirectUri?: string; locale?: string; theme?: string }): Promise<void> => {
    const currentLang = options?.locale || localStorage.getItem('cinema_lang') || localStorage.getItem('i18nextLng') || localStorage.getItem('lang') || 'vi';
    const currentTheme = options?.theme || localStorage.getItem('cinema_theme') || 'system';

    const registerUrl = await keycloak.createRegisterUrl({
      redirectUri: options?.redirectUri || `${window.location.origin}/auth/callback`,
      locale: currentLang,
    });
    window.location.assign(`${registerUrl}&theme=${encodeURIComponent(currentTheme)}`);
  },

  forgotPassword: async (options?: { redirectUri?: string; locale?: string; theme?: string }): Promise<void> => {
    const currentLang = options?.locale || localStorage.getItem('cinema_lang') || localStorage.getItem('i18nextLng') || localStorage.getItem('lang') || 'vi';
    const currentTheme = options?.theme || localStorage.getItem('cinema_theme') || 'system';

    const loginUrl = await keycloak.createLoginUrl({
      action: 'UPDATE_PASSWORD',
      redirectUri: options?.redirectUri || `${window.location.origin}/`,
      locale: currentLang,
    });
    window.location.assign(`${loginUrl}&theme=${encodeURIComponent(currentTheme)}`);
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

  fetchInternalProfile: async (): Promise<any> => {
    try {
      const { data } = await apiClient.get('/users/me');
      return data?.data;
    } catch (e) {
      console.error('Failed to fetch internal profile', e);
      return null;
    }
  },
};

export default apiClient;
