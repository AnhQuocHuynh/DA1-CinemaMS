import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'
import App from './App.tsx'
import keycloak from './lib/keycloak';
import { useAuthStore } from './store/authStore';

function extractKeycloakRoles(tokenParsed: any): string[] {
  const roles: string[] = [];
  if (tokenParsed?.realm_access?.roles) {
    roles.push(...tokenParsed.realm_access.roles);
  }
  if (tokenParsed?.resource_access) {
    Object.values(tokenParsed.resource_access).forEach((client: any) => {
      if (client?.roles) roles.push(...client.roles);
    });
  }
  return roles.map(r => String(r).toUpperCase());
}

function mapKeycloakRole(roles: string[]): 'ADMIN' | 'STAFF' | 'USER' {
  if (roles.includes('ADMIN') || roles.includes('CINEMA-ADMIN')) return 'ADMIN';
  if (roles.includes('STAFF') || roles.includes('CINEMA-STAFF')) return 'STAFF';
  return 'USER';
}

keycloak.init({
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod: 'S256',
  checkLoginIframe: false,
}).then((authenticated) => {
  if (authenticated && keycloak.tokenParsed) {
    const { sub, email, preferred_username } = keycloak.tokenParsed;
    useAuthStore.getState().setUser({
      id: sub!,
      keycloakId: sub!,
      email: email!,
      username: preferred_username!,
      role: mapKeycloakRole(extractKeycloakRoles(keycloak.tokenParsed)),
      token: keycloak.token!,
      refreshToken: keycloak.refreshToken!,
    });
  }

  keycloak.onTokenExpired = () => {
    keycloak.updateToken(30)
      .then((refreshed) => {
        if (refreshed) useAuthStore.getState().setToken(keycloak.token!);
      })
      .catch(() => keycloak.logout());
  };

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}).catch(() => {
  console.error("Failed to initialize Keycloak");
});
