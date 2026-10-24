import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import keycloak from '../lib/keycloak';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { useTranslation } from 'react-i18next';

export function AuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => {
    if (keycloak.authenticated && keycloak.tokenParsed) {
      const allRoles: string[] = [];
      if (keycloak.tokenParsed.realm_access?.roles) allRoles.push(...keycloak.tokenParsed.realm_access.roles);
      if (keycloak.tokenParsed.resource_access) {
        Object.values(keycloak.tokenParsed.resource_access).forEach((client: any) => {
          if (client?.roles) allRoles.push(...client.roles);
        });
      }
      const upperRoles = allRoles.map(r => String(r).toUpperCase());
      const role = (upperRoles.includes('ADMIN') || upperRoles.includes('CINEMA-ADMIN')) ? 'ADMIN'
                   : (upperRoles.includes('STAFF') || upperRoles.includes('CINEMA-STAFF')) ? 'STAFF' : 'USER';
      useAuthStore.getState().setUser({
        id: keycloak.tokenParsed.user_id ? String(keycloak.tokenParsed.user_id) : keycloak.tokenParsed.sub!,
        keycloakId: keycloak.tokenParsed.sub!,
        email:      keycloak.tokenParsed.email!,
        username:   keycloak.tokenParsed.preferred_username!,
        role:       role,
        token:      keycloak.token!,
        refreshToken: keycloak.refreshToken!,
      });

      if (!keycloak.tokenParsed.user_id) {
        authService.fetchInternalProfile().then(profile => {
          if (profile?.id) {
            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
              useAuthStore.getState().setUser({
                ...currentUser,
                id: String(profile.id),
              });
            }
          }
        });
      }

      if (role === 'ADMIN')      navigate('/admin/dashboard');
      else if (role === 'STAFF') navigate('/staff/dashboard');
      else                       navigate('/');
    } else {
      navigate('/login');
    }
  }, [navigate]);
  return <div className="flex h-screen items-center justify-center">{t('authCallback.signingIn', 'Signing you in…')}</div>;
}
