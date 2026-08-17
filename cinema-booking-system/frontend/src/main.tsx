import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'
import App from './App.tsx'
import keycloak from './lib/keycloak';
import { useAuthStore } from './store/authStore';

function mapKeycloakRole(roles: string[]): 'ADMIN' | 'STAFF' | 'USER' {
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('STAFF')) return 'STAFF';
  return 'USER';
}

keycloak.init({
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod: 'S256',
  checkLoginIframe: false,
}).then((authenticated) => {
  if (authenticated && keycloak.tokenParsed) {
    const { sub, email, realm_access, preferred_username } = keycloak.tokenParsed;
    useAuthStore.getState().setUser({
      id: sub!,
      keycloakId: sub!,
      email: email!,
      username: preferred_username!,
      role: mapKeycloakRole(realm_access?.roles ?? []),
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
