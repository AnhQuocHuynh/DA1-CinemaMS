import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import keycloak from '../lib/keycloak';
import { useAuthStore } from '../store/authStore';

export function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    if (keycloak.authenticated && keycloak.tokenParsed) {
      const roles = keycloak.tokenParsed.realm_access?.roles ?? [];
      const role = roles.includes('ADMIN') ? 'ADMIN'
                   : roles.includes('STAFF') ? 'STAFF' : 'USER';
      useAuthStore.getState().setUser({
        id: keycloak.tokenParsed.sub!,
        keycloakId: keycloak.tokenParsed.sub!,
        email:      keycloak.tokenParsed.email!,
        username:   keycloak.tokenParsed.preferred_username!,
        role:       role,
        token:      keycloak.token!,
        refreshToken: keycloak.refreshToken!,
      });
      if (role === 'ADMIN')      navigate('/admin/dashboard');
      else if (role === 'STAFF') navigate('/staff/dashboard');
      else                       navigate('/');
    } else {
      navigate('/login');
    }
  }, [navigate]);
  return <div className="flex h-screen items-center justify-center">Signing you in…</div>;
}
