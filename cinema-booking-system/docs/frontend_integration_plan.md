# Cinema Booking System — Frontend Integration Plan

> **Status**: Proposed | **Date**: 2026-07-19
> **Companion Document**: [architecture_refactor.md](./architecture_refactor.md)
> **Frontend Stack**: React 18 + TypeScript + Vite + Zustand + Axios
> **Scope**: Migrating the existing SPA from the Spring Boot monolith to the new polyglot microservices backend with Keycloak IAM

---

## Table of Contents

1. [Overview and Goals](#1-overview--goals)
2. [Current Frontend State Analysis](#2-current-frontend-state-analysis)
3. [Target Integration Architecture](#3-target-integration-architecture)
4. [Keycloak Authentication Integration](#4-keycloak-authentication-integration)
5. [API Layer Refactor](#5-api-layer-refactor)
6. [Service-by-Service Integration Guide](#6-service-by-service-integration-guide)
7. [Token and Session Management](#7-token--session-management)
8. [Role-Based Access Control](#8-role-based-access-control-rbac)
9. [Error Handling and Resilience](#9-error-handling--resilience)
10. [Environment Configuration](#10-environment-configuration)
11. [Migration Roadmap](#11-migration-roadmap-phase-by-phase)
12. [Testing Strategy](#12-testing-strategy)

---

## 1. Overview & Goals

This document defines **how the React frontend integrates** with the new microservices backend described in `architecture_refactor.md`. All traffic is routed through the **YARP API Gateway** at a single base URL — the frontend never calls microservices directly.

### Key Changes from Monolith

| Concern | Monolith (Before) | Microservices (After) |
|---|---|---|
| **Auth** | Custom JWT from Spring Boot `/api/auth/login` | Keycloak OIDC — Authorization Code + PKCE |
| **Token claims** | `{ id: Long, roles: ["ROLE_ADMIN"] }` in response body | Keycloak JWT: `sub` (UUID), `realm_access.roles`, `email`, `preferred_username` |
| **Registration** | Frontend `POST /api/auth/register` | Redirect to Keycloak-branded register page |
| **Password reset** | Frontend `POST /api/auth/forgot-password` | Keycloak hosted forgot-password flow |
| **API base URL** | `http://localhost:8080/api` (Spring Boot monolith) | `http://localhost:5000/api` (YARP Gateway) |
| **User ID in requests** | `Long` embedded in JWT | Gateway resolves UUID -> Long, injects `X-User-Id` |
| **Token refresh** | Custom `POST /api/auth/refresh` | Keycloak `grant_type=refresh_token` |
| **Logout** | `POST /api/auth/logout` | Keycloak `/protocol/openid-connect/logout` |

### Goals

- **Single entry point**: All API calls go through `VITE_API_BASE_URL` -> YARP Gateway (`:5000`).
- **Keycloak OIDC PKCE**: Replace custom auth with standards-based OpenID Connect.
- **Minimal page breakage**: Route structure, Zustand store shape, and UI components remain unchanged where possible.
- **Transparent token refresh**: Silent background refresh before expiry; no user-visible interruption.
- **Role extraction from JWT**: Parse `realm_access.roles` from Keycloak token instead of monolith's `roles` array.

---

## 2. Current Frontend State Analysis

### 2.1 Existing Auth Flow (Monolith)

The current flow in `authService.ts`:
1. User submits Login form -> `POST /api/auth/login` (Spring Boot monolith)
2. Response: `{ data: { accessToken, refreshToken, user: { id, email, roles[] } } }`
3. Token stored in `localStorage('authToken')`
4. Role normalized: `ROLE_ADMIN` -> `ADMIN` etc.
5. Zustand store updated

**Files affected by migration:**

| File | Current Behavior | Change Required |
|---|---|---|
| `src/services/authService.ts` | Custom JWT login/register/refresh against monolith | Full rewrite for Keycloak OIDC PKCE |
| `src/store/authStore.ts` | `{ token, user: { id, email, role } }` | Add `keycloakId` (UUID sub); remove `id: Long` |
| `src/components/ProtectedRoute.tsx` | Checks local token + role from store | **No change needed** |
| `pages/Login.tsx`, `pages/SignUp.tsx` | Custom login/register forms | Replace submit with Keycloak redirect |
| `pages/ForgotPassword.tsx` | Custom form calling monolith | Replace with Keycloak hosted flow redirect |
| `pages/ResetPassword.tsx` | Custom reset form | Remove — Keycloak owns this flow |
| All `services/*.ts` | `baseURL: localhost:8080/api` | Import shared `apiClient` pointing to `:5000` |

### 2.2 Current Service Files

| Service File | Routes | Target Microservice (After) |
|---|---|---|
| `authService.ts` | `/auth/*` | Keycloak (proxied via Gateway `/api/auth/**`) |
| `movieService.ts` | `/movies/*` | Catalog Service `:8081` |
| `eventService.ts` | `/events/*` | Catalog Service `:8081` |
| `catalogService.ts` | `/catalog/*` | Catalog Service `:8081` |
| `cinemaService.ts` | `/cinemas/*` | Facility Service `:5002` |
| `showtimeService.ts` | `/showtimes/*` | Showtime Service `:8082` |
| `bookingService.ts` | `/orders/*`, `/tickets/*` | Booking Service `:8083` |
| `reviewService.ts` | `/reviews/*` | Booking Service `:8083` |
| `adminService.ts` | `/admin/dashboard/*` | Analytics Service `:8084` |
| `staffService.ts` | `/staff/*` | Booking Service `:8083` |

**No service file API paths change** — only the `baseURL` shifts from monolith `:8080` to the gateway `:5000`.

---

## 3. Target Integration Architecture

```
+---------------------------------------------------------------------------+
|                  React SPA (Vite, :5173 dev / :80 prod)                   |
|                                                                           |
|  +-------------+  +--------------+  +--------------+  +--------------+   |
|  | authService  |  | movieService  |  |bookingService|  | adminService |   |
|  |(Keycloak    |  |(Catalog svc) |  |(Booking svc) |  |(Analytics)   |   |
|  | OIDC PKCE)  |  |              |  |              |  |              |   |
|  +------+------+  +------+-------+  +------+-------+  +------+-------+   |
|         |                +-----------------+-----------------+            |
|         |                         All services share                      |
|         |                   +---------------------------+                 |
|         |                   |   src/lib/apiClient.ts    |                 |
|         |                   |   baseURL: VITE_API_URL   |                 |
|         |                   |   interceptors:           |                 |
|         |                   |    - Inject Bearer token  |                 |
|         |                   |    - 401 -> auto-refresh  |                 |
|         |                   |    - 403 -> redirect /    |                 |
|         |                   +-------------+-------------+                 |
+---------|-------------------------------|------------------------------------+
          |                               | HTTPS
          v                               v
       +--------------------------------------------------+
       |           YARP API Gateway  (:5000)              |
       |  JWT validation (Keycloak JWKS)                  |
       |  Rate limiting (Redis)   CORS headers            |
       |  X-User-Id injection     X-User-Roles forwarding |
       +----+----------+----------+-----------+-----------+
            |          |          |           |
            v          v          v           v
      Keycloak:8080  Catalog:8081  Showtime:8082  Booking:8083 ...
```

### 3.1 Single Gateway Base URL

```
VITE_API_BASE_URL=http://localhost:5000/api    # Dev: YARP Gateway
VITE_KEYCLOAK_URL=http://localhost:8080        # Keycloak server
VITE_KEYCLOAK_REALM=cinema-booking
VITE_KEYCLOAK_CLIENT_ID=cinema-frontend
```

---

## 4. Keycloak Authentication Integration

### 4.1 Approach: `keycloak-js` Adapter (PKCE — Authorization Code Flow)

The architecture designates `cinema-frontend` as a **Public OIDC client** using **Authorization Code + PKCE** (Proof Key for Code Exchange). This is the current industry-standard secure approach for SPAs.

**Install:**
```bash
npm install keycloak-js
```

**`src/lib/keycloak.ts`** — Singleton:
```typescript
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url:      import.meta.env.VITE_KEYCLOAK_URL,
  realm:    import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

export default keycloak;
```

**`src/main.tsx`** — Initialize before React renders:
```typescript
import keycloak from './lib/keycloak';
import { useAuthStore } from './store/authStore';

keycloak.init({
  onLoad: 'check-sso',   // Detect existing session silently (no forced redirect)
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod: 'S256',
  checkLoginIframe: false,
}).then((authenticated) => {
  if (authenticated && keycloak.tokenParsed) {
    const { sub, email, realm_access, preferred_username } = keycloak.tokenParsed;
    useAuthStore.getState().setUser({
      keycloakId: sub!,
      email: email!,
      username: preferred_username!,
      role: mapKeycloakRole(realm_access?.roles ?? []),
      token: keycloak.token!,
      refreshToken: keycloak.refreshToken!,
    });
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>
  );
});

function mapKeycloakRole(roles: string[]): 'ADMIN' | 'STAFF' | 'USER' {
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('STAFF')) return 'STAFF';
  return 'USER';
}
```

**`public/silent-check-sso.html`** — Required by `keycloak-js`:
```html
<!doctype html>
<html><body>
  <script>parent.postMessage(location.href, location.origin);</script>
</body></html>
```

---

### 4.2 Rewritten `authService.ts` (Keycloak-based)

```typescript
// src/services/authService.ts  (FULL REWRITE)
import keycloak from '../lib/keycloak';
import { useAuthStore } from '../store/authStore';

export const authService = {
  /** Redirect to Keycloak login (PKCE Authorization Code). */
  login: (): void => {
    keycloak.login({ redirectUri: `${window.location.origin}/auth/callback` });
  },

  /** Redirect to Keycloak registration page (uses cinema-theme FTL). */
  register: (): void => {
    keycloak.register({ redirectUri: `${window.location.origin}/auth/callback` });
  },

  /** Redirect to Keycloak's built-in forgot-password / UPDATE_PASSWORD action. */
  forgotPassword: (): void => {
    keycloak.login({ action: 'UPDATE_PASSWORD', redirectUri: `${window.location.origin}/` });
  },

  /**
   * Proactive silent token refresh.
   * Called by Axios interceptor before each request.
   * Returns new access token or null on failure (triggers logout).
   */
  refreshToken: async (): Promise<string | null> => {
    try {
      const refreshed = await keycloak.updateToken(60); // refresh if < 60s remaining
      if (refreshed) useAuthStore.getState().setToken(keycloak.token!);
      return keycloak.token ?? null;
    } catch {
      authService.logout();
      return null;
    }
  },

  /**
   * Full logout: terminates Keycloak SSO session server-side + clears local state.
   */
  logout: (): void => {
    useAuthStore.getState().clearUser();
    keycloak.logout({ redirectUri: `${window.location.origin}/` });
  },

  isAuthenticated: (): boolean => keycloak.authenticated ?? false,
  getToken:        (): string | null => keycloak.token ?? null,

  /** Decode and return user identity from Keycloak access token. */
  getUserInfo: () => {
    if (!keycloak.tokenParsed) return null;
    const { sub, email, preferred_username, given_name, family_name, realm_access } =
      keycloak.tokenParsed;
    return { keycloakId: sub, email, username: preferred_username,
             firstName: given_name, lastName: family_name,
             roles: realm_access?.roles ?? [] };
  },
};

export default authService;
```

---

### 4.3 Auth Callback Page

Add `src/pages/AuthCallback.tsx` to handle the post-login redirect:

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import keycloak from '../lib/keycloak';
import { useAuthStore } from '../store/authStore';

export function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    if (keycloak.authenticated && keycloak.tokenParsed) {
      const roles = keycloak.tokenParsed.realm_access?.roles ?? [];
      useAuthStore.getState().setUser({
        keycloakId: keycloak.tokenParsed.sub!,
        email:      keycloak.tokenParsed.email!,
        username:   keycloak.tokenParsed.preferred_username!,
        role:       roles.includes('ADMIN') ? 'ADMIN'
                  : roles.includes('STAFF') ? 'STAFF' : 'USER',
        token:        keycloak.token!,
        refreshToken: keycloak.refreshToken!,
      });
      if (roles.includes('ADMIN'))      navigate('/admin/dashboard');
      else if (roles.includes('STAFF')) navigate('/staff/dashboard');
      else                              navigate('/');
    } else {
      navigate('/login');
    }
  }, [navigate]);
  return <div>Signing you in…</div>;
}
```

Register in `App.tsx`:
```tsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

---

### 4.4 Login, SignUp, ForgotPassword Page Strategy

> **Recommended: Branded Keycloak Theme (Strategy C)**

Per `keycloak_setup_guide.md` Section 8, a custom FreeMarker theme (`cinema-theme`) already mirrors the React frontend design. The themed `register.ftl` is already implemented. Users are redirected to Keycloak but see the same cinema branding — no visible context switch.

**`pages/Login.tsx`** (simplified):
```tsx
export function Login() {
  return (
    <div className="..."> {/* existing marketing/branding layout */}
      <button onClick={() => authService.login()}>Sign In</button>
      <button onClick={() => authService.register()}>Create Account</button>
    </div>
  );
}
```

**`pages/ForgotPassword.tsx`** (simplified):
```tsx
export function ForgotPassword() {
  return (
    <div>
      <button onClick={() => authService.forgotPassword()}>Reset Password</button>
    </div>
  );
}
```

**`pages/ResetPassword.tsx`**: **Remove** — Keycloak handles the full reset email + confirmation flow via the `UPDATE_PASSWORD` action URL.

---

## 5. API Layer Refactor

### 5.1 Shared Axios Instance (`src/lib/apiClient.ts`)

Create one Axios instance shared by all service files:

```typescript
// src/lib/apiClient.ts  (NEW)
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import keycloak from './keycloak';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Inject Keycloak Bearer token; refresh proactively if < 30s remaining
apiClient.interceptors.request.use(async (config) => {
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch {
      keycloak.logout();
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }
    config.headers.Authorization = `Bearer ${keycloak.token}`;
  }
  return config;
});

// Handle 401 (force-refresh + retry once) and 403 (redirect home)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await keycloak.updateToken(-1);
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${keycloak.token}`,
        };
        return apiClient(originalRequest);
      } catch {
        keycloak.logout();
        return Promise.reject(error);
      }
    }
    if (error.response?.status === 403) {
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 5.2 Migrating Existing Service Files

The **only change** needed in existing service files: replace local `axios.create()` with the shared import:

```typescript
// BEFORE (every service file)
import axios from 'axios';
const apiClient = axios.create({ baseURL: 'http://localhost:8080/api' });

// AFTER
import apiClient from '../lib/apiClient';
```

Files requiring only this import change (no path changes):
`movieService.ts`, `eventService.ts`, `catalogService.ts`, `cinemaService.ts`,
`showtimeService.ts`, `bookingService.ts`, `reviewService.ts`, `adminService.ts`, `staffService.ts`

---

## 6. Service-by-Service Integration Guide

### 6.1 Auth -> Keycloak (`/api/auth/**`)

The YARP Gateway proxies `/api/auth/**` to Keycloak `:8080`. The `keycloak-js` adapter handles all PKCE token exchange internally. The frontend does not call these endpoints directly.

Relevant endpoints (reference only):
- Token: `POST /api/auth/realms/cinema-booking/protocol/openid-connect/token`
- JWKS: `GET /api/auth/realms/cinema-booking/protocol/openid-connect/certs`
- Logout: `GET /api/auth/realms/cinema-booking/protocol/openid-connect/logout`

---

### 6.2 User Profile Service (`/api/users/**`)

**Gateway route**: `users-route` -> User Profile Service `:5001`
**Auth required**: Yes (all routes)

Replaces the monolith's `iam` module for profile data. Keycloak owns credentials; the User Profile Service owns extended profile fields.

**New `src/services/userService.ts`:**
```typescript
import apiClient from '../lib/apiClient';

export interface UserProfile {
  id: number;          // internal Long ID (user_profile_db)
  keycloakId: string;  // Keycloak UUID (sub claim)
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  avatarUrl?: string;
}

export const userService = {
  getMyProfile: () =>
    apiClient.get<UserProfile>('/users/me').then(r => r.data),

  updateMyProfile: (data: Partial<UserProfile>) =>
    apiClient.put<UserProfile>('/users/me', data).then(r => r.data),
};
```

> **Note**: The Gateway resolves the Keycloak UUID (`sub`) to the internal `Long` user ID via the User Profile Service's `/internal/users/resolve` endpoint and injects it as `X-User-Id`. Downstream services (Booking, Showtime) use this Long ID, so the frontend never needs to send `userId` in request bodies.

---

### 6.3 Catalog Service (`/api/movies/**`, `/api/events/**`, `/api/genres/**`)

**Gateway route**: `catalog-route` -> Catalog Service `:8081`
**Auth required**: GET = No | POST/PUT/DELETE = Yes (ADMIN)

No path changes. Only the shared `apiClient` import is needed. Response DTOs remain identical to the monolith.

---

### 6.4 Facility Service (`/api/cinemas/**`)

**Gateway route**: `cinemas-route` -> Facility Service `:5002`
**Auth required**: GET = No | POST/PUT/DELETE = Yes (ADMIN)

No path changes. Only the shared `apiClient` import is needed.

---

### 6.5 Showtime Service (`/api/showtimes/**`)

**Gateway route**: `showtime-route` -> Showtime Service `:8082`
**Auth required**: GET = No | seat hold/release = Yes

**Seat hold flow** is critical — backend enforces a 5-minute Redis TTL:

```typescript
// New methods to add to showtimeService.ts
holdSeats: (showtimeId: number, seatIds: number[]) =>
  apiClient.post(`/showtimes/${showtimeId}/hold`, { seatIds }),

releaseSeats: (showtimeId: number, seatIds: number[]) =>
  apiClient.delete(`/showtimes/${showtimeId}/hold`, { data: { seatIds } }),
```

> **UI Requirement**: Display a **5-minute countdown timer** in `Booking.tsx` after seats are held. Call `releaseSeats()` on component unmount using a `useEffect` cleanup and a `beforeunload` event listener.

---

### 6.6 Booking Service (`/api/orders/**`, `/api/tickets/**`, `/api/vouchers/**`, `/api/reviews/**`)

**Gateway route**: `booking-route` -> Booking Service `:8083`
**Auth required**: Yes (all routes)

The frontend drives the Booking Saga in sequence:

```typescript
// 1. Hold seats (Showtime Service) — 5-min TTL
await showtimeService.holdSeats(showtimeId, seatIds);

// 2. Create order (Booking Service — validates held seats internally)
const order = await bookingService.createOrder({ showtimeId, seatIds, voucherCode });

// 3. Initiate payment (Payment Service)
const payment = await paymentService.initiatePayment({
  orderId: order.id,
  paymentMethod: 'CREDIT_CARD',
  amount: order.finalAmount,
});

// 4. Handle result
// - Direct payment: poll for COMPLETED status
// - VNPay/MoMo: redirect to payment.paymentUrl; handle return on /checkout-success
```

**Compensation (payment failed -> seats released by backend saga):**
```typescript
try {
  await paymentService.initiatePayment({ ... });
} catch (error) {
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    navigate(`/user/booking/${showtimeId}`, {
      state: { error: 'Some seats are no longer available. Please re-select.' }
    });
  }
}
```

---

### 6.7 Payment Service (`/api/payments/**`)

**Gateway route**: `payment-route` -> Payment Service `:5003`
**Auth required**: Yes

New service extracted from monolith. Create `src/services/paymentService.ts`:

```typescript
import apiClient from '../lib/apiClient';

export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'VNPAY' | 'MOMO' | 'CASH';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface PaymentRequest {
  orderId: number;
  paymentMethod: PaymentMethod;
  amount: number;
  returnUrl?: string;  // VNPay/MoMo redirect URL
}

export interface PaymentResponse {
  transactionId: string;
  status: PaymentStatus;
  paymentUrl?: string;  // redirect for VNPay/MoMo
  paidAt?: string;
}

export const paymentService = {
  initiatePayment: (data: PaymentRequest) =>
    apiClient.post<PaymentResponse>('/payments', data).then(r => r.data),

  getPaymentStatus: (transactionId: string) =>
    apiClient.get<PaymentResponse>(`/payments/${transactionId}`).then(r => r.data),

  // Called on /checkout-success after VNPay redirect
  handleVnPayReturn: (queryParams: URLSearchParams) =>
    apiClient.post<PaymentResponse>(
      '/payments/vnpay/return',
      Object.fromEntries(queryParams)
    ).then(r => r.data),
};
```

---

### 6.8 Analytics Service (`/api/admin/dashboard/**`)

**Gateway route**: `analytics-route` -> Analytics Service `:8084`
**Auth required**: Yes (ADMIN only)

No path changes. Only the shared `apiClient` import is needed. Revenue charts, popular movies, and live-sales response shapes are unchanged from the monolith's admin module.

---

### 6.9 Recommendation Service (`/api/recommendations/**`)

**Gateway route**: `recommendations-route` -> Recommendation Service `:8085`
**Auth required**: Personalized = Yes | Popular/Similar = No

New service (not in monolith). Create `src/services/recommendationService.ts`:

```typescript
import apiClient from '../lib/apiClient';

export interface MovieRecommendation {
  movieId: number;
  title: string;
  posterUrl: string;
  score: number;   // confidence 0.0-1.0
  tier: 'COLLABORATIVE' | 'CONTENT_BASED' | 'POPULAR';
}

export const recommendationService = {
  /** Personalized recs — requires auth; falls through Tier 1 -> 2 -> 3 */
  getPersonalized: (limit = 10) =>
    apiClient
      .get<MovieRecommendation[]>('/recommendations/movies', { params: { limit } })
      .then(r => r.data),

  /** Globally popular movies — no auth required */
  getPopular: (limit = 10) =>
    apiClient
      .get<MovieRecommendation[]>('/recommendations/movies/popular', { params: { limit } })
      .then(r => r.data),

  /** Content-similar movies — no auth required */
  getSimilar: (movieId: number, limit = 6) =>
    apiClient
      .get<MovieRecommendation[]>(`/recommendations/movies/${movieId}/similar`,
        { params: { limit } })
      .then(r => r.data),
};
```

---

## 7. Token & Session Management

### 7.1 Token Storage Strategy

| Token | Storage | Rationale |
|---|---|---|
| **Access Token** | `keycloak.token` (in-memory via `keycloak-js`) | Never persisted to `localStorage` — prevents XSS token theft |
| **Refresh Token** | `keycloak-js` internal storage (sessionStorage) | Survives page refresh; cleared on tab close |
| **ID Token** | `keycloak.idToken` (in-memory) | Used for logout `id_token_hint` to end SSO session server-side |

> **Action Required**: Remove the existing `localStorage.setItem('authToken', ...)` and `localStorage.getItem('authToken')` patterns from `authService.ts`. The `keycloak-js` adapter manages token lifecycle.

### 7.2 Automatic Token Refresh

```typescript
// src/main.tsx — after keycloak.init()
keycloak.onTokenExpired = () => {
  keycloak.updateToken(30)
    .then((refreshed) => {
      if (refreshed) useAuthStore.getState().setToken(keycloak.token!);
    })
    .catch(() => keycloak.logout());
};
```

The Axios interceptor in `apiClient.ts` also calls `keycloak.updateToken(30)` before every request, creating a two-layer refresh safety net.

### 7.3 Token TTL

| Token | TTL (from architecture doc Section 10.3) |
|---|---|
| Access Token | 5 minutes |
| Refresh Token | 30 minutes (sliding) |

### 7.4 Booking Flow Session State

Use **`sessionStorage`** (not `localStorage`) for transient booking state:

```typescript
// After holdSeats() succeeds:
sessionStorage.setItem('pendingBooking', JSON.stringify({
  showtimeId,
  selectedSeatIds,
  holdExpiresAt: Date.now() + 5 * 60 * 1000,
}));

// On Booking.tsx unmount (cancel / navigate away):
useEffect(() => {
  return () => {
    const pending = sessionStorage.getItem('pendingBooking');
    if (pending) {
      const { showtimeId, selectedSeatIds } = JSON.parse(pending);
      showtimeService.releaseSeats(showtimeId, selectedSeatIds);
      sessionStorage.removeItem('pendingBooking');
    }
  };
}, []);
```

---

## 8. Role-Based Access Control (RBAC)

### 8.1 Role Extraction from Keycloak JWT

```typescript
// BEFORE — monolith JWT decoded:
{ "id": 42, "email": "user@example.com", "roles": ["ROLE_CUSTOMER"] }

// AFTER — Keycloak tokenParsed:
{
  "sub": "uuid-of-user",
  "email": "user@example.com",
  "preferred_username": "john.doe",
  "realm_access": { "roles": ["CUSTOMER", "offline_access"] },
  "exp": 1750000000
}
```

> **Breaking change**: Remove `.replace('ROLE_', '')` normalization from authService.ts. Keycloak roles have no `ROLE_` prefix. Roles are: `ADMIN`, `STAFF`, `CUSTOMER`.

### 8.2 `ProtectedRoute` — No Changes Required

The existing component reads `user.role` from Zustand (`'ADMIN' | 'STAFF' | 'USER'`). Since `mapKeycloakRole()` maps `CUSTOMER` -> `USER`, the comparisons in `ProtectedRoute` remain valid.

### 8.3 Updated Zustand Auth Store Shape

```typescript
// src/store/authStore.ts
interface AuthUser {
  keycloakId: string;    // Keycloak UUID (sub) — NEW
  email: string;
  username: string;      // preferred_username
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'STAFF' | 'USER';
  token: string;         // Current access token (updated on silent refresh)
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser:    (user: AuthUser) => void;
  setToken:   (token: string) => void;  // NEW: for silent refresh updates
  clearUser:  () => void;
}
```

---

## 9. Error Handling & Resilience

### 9.1 HTTP Status -> Frontend Behavior

| Status | Cause | Frontend Action |
|---|---|---|
| `401 Unauthorized` | Token expired or invalid | `keycloak.updateToken(-1)` -> retry; if fail -> logout |
| `403 Forbidden` | Insufficient role | Redirect to `/` + toast: "You don't have permission" |
| `404 Not Found` | Resource missing | Inline error or 404 page |
| `409 Conflict` | Seat booked by another user / idempotency conflict | Show "Seat unavailable" -> re-fetch seat map |
| `429 Too Many Requests` | YARP rate limit (see architecture doc Section 7.2) | Show retry countdown using `Retry-After` header |
| `503 Service Unavailable` | Polly circuit breaker open on Gateway | Show service unavailable banner |

### 9.2 Rate Limit Handling

```typescript
// apiClient.ts interceptor addition
if (error.response?.status === 429) {
  const retryAfter = parseInt(error.response.headers['retry-after'] ?? '60', 10);
  // Emit event to UI layer for countdown display
  throw { code: 'RATE_LIMITED', retryAfter };
}
```

### 9.3 Network Error (Gateway Unreachable)

```typescript
if (!error.response) {
  throw new Error('Unable to reach server. Please check your connection.');
}
```

---

## 10. Environment Configuration

### 10.1 `.env` Files

**`frontend/.env.development`:**
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=cinema-booking
VITE_KEYCLOAK_CLIENT_ID=cinema-frontend
VITE_REDIRECT_URI=http://localhost:5173/auth/callback
```

**`frontend/.env.production`:**
```env
VITE_API_BASE_URL=https://api.cinema.example.com/api
VITE_KEYCLOAK_URL=https://auth.cinema.example.com
VITE_KEYCLOAK_REALM=cinema-booking
VITE_KEYCLOAK_CLIENT_ID=cinema-frontend
VITE_REDIRECT_URI=https://cinema.example.com/auth/callback
```

> **Security**: `VITE_` variables are embedded in the client bundle. Never put secrets here. The `cinema-frontend` client is **public** (no client secret — it uses PKCE instead).

### 10.2 Keycloak Client `cinema-frontend` — Required Settings

| Setting | Dev Value | Prod Value |
|---|---|---|
| Client Type | OpenID Connect | OpenID Connect |
| Client Authentication | OFF (Public) | OFF (Public) |
| Standard Flow | Enabled | Enabled |
| Valid Redirect URIs | `http://localhost:5173/*` | `https://cinema.example.com/*` |
| Valid Post Logout URIs | `http://localhost:5173/*` | `https://cinema.example.com/*` |
| Web Origins (CORS) | `http://localhost:5173` | `https://cinema.example.com` |
| PKCE Code Challenge Method | S256 | S256 |

Refer to `keycloak_setup_guide.md` Section 4 (Client 1: `cinema-frontend`) for step-by-step Keycloak Admin configuration.

### 10.3 CORS — Gateway Already Configured

`appsettings.json` already allows Vite dev server:
```json
"Cors": { "AllowedOrigins": ["http://localhost:3000", "http://localhost:5173"] }
```

Add the production origin when deploying:
```json
"Cors": { "AllowedOrigins": ["https://cinema.example.com"] }
```

---

## 11. Migration Roadmap (Phase-by-Phase)

Mirrors the backend migration from `architecture_refactor.md` Section 14.

### Phase 0 -> 1: Auth + Gateway (Weeks 1-4) — Highest Priority

Replace custom JWT with Keycloak OIDC. Switch all API calls to YARP Gateway.

| Task | File | Type |
|---|---|---|
| Install `keycloak-js` | `package.json` | New dependency |
| Create Keycloak singleton | `src/lib/keycloak.ts` | New file |
| Create shared Axios client | `src/lib/apiClient.ts` | New file |
| Initialize PKCE before React render | `src/main.tsx` | Modify |
| Add silent SSO check page | `public/silent-check-sso.html` | New file |
| Rewrite auth service | `src/services/authService.ts` | Full rewrite |
| Update Zustand auth store interface | `src/store/authStore.ts` | Modify |
| Add auth callback page | `src/pages/AuthCallback.tsx` | New file |
| Register `/auth/callback` route | `src/App.tsx` | Modify |
| Simplify Login page | `src/pages/Login.tsx` | Modify |
| Simplify SignUp page | `src/pages/SignUp.tsx` | Modify |
| Simplify ForgotPassword page | `src/pages/ForgotPassword.tsx` | Modify |
| Remove ResetPassword page | `src/pages/ResetPassword.tsx` | Remove |
| Update all services to import shared client | All `services/*.ts` | Modify |
| Update env files | `.env.development` | Modify |

### Phase 2: Catalog (Weeks 5-6)

Verify Catalog Service DTO shapes match monolith (no change expected — same module migrated).

### Phase 3: Facility (Weeks 7-8)

Verify `cinemaService.ts` room/seat-type DTO shapes against Facility Service OpenAPI spec.

### Phase 4: Showtime (Weeks 9-11)

| Task | File |
|---|---|
| Add `holdSeats()` / `releaseSeats()` | `showtimeService.ts` |
| Add 5-minute hold countdown timer | `pages/portal/Booking.tsx` |
| Add `beforeunload` cleanup to release seats | `pages/portal/Booking.tsx` |
| Handle `409 Conflict` on expired hold | `pages/portal/Checkout.tsx` |

### Phase 5: Booking + Payment (Weeks 12-15)

| Task | File |
|---|---|
| Create Payment Service integration | `services/paymentService.ts` (new) |
| Separate payment step from order creation | `pages/portal/Checkout.tsx` |
| Handle VNPay/MoMo redirect return | `pages/portal/CheckoutSuccess.tsx` |
| Add payment status polling / loading state | `pages/portal/CheckoutSuccess.tsx` |

### Phase 6: Notification + Analytics (Weeks 16-18)

| Task | Change |
|---|---|
| Verify `adminService.ts` shapes vs Analytics Service | No change expected |
| Optional: SignalR WebSocket for live admin stats | New `useSignalR` hook |

### Phase 7: Recommendations (Post-Decommission)

| Task | File |
|---|---|
| Create Recommendation Service integration | `services/recommendationService.ts` (new) |
| Add personalized recommendations to Home | New `RecommendedMovies` component |
| Add similar movies to MovieDetails | New `SimilarMovies` component |

---

## 12. Testing Strategy

### 12.1 Auth Flow (Cypress E2E)

| Scenario | Expected Outcome |
|---|---|
| Login as CUSTOMER -> callback | Redirect to `/` |
| Login as ADMIN -> callback | Redirect to `/admin/dashboard` |
| Login as STAFF -> callback | Redirect to `/staff/dashboard` |
| Access `/admin/dashboard` without ADMIN role | 403 -> redirect to `/` |
| Token expired during API call | Silent refresh -> request retried successfully |
| Refresh token expired | Logout triggered, user lands on `/` |
| Keycloak logout | SSO session cleared; next protected route visit requires login |

### 12.2 API Service Tests (Jest + MSW)

| Scenario | Tool |
|---|---|
| All services use `localhost:5000` base URL | Jest snapshot |
| Bearer token injected in Authorization header | Jest + Axios interceptor mock |
| `movieService.getMovies()` -> `GET /movies` | MSW (Mock Service Worker) |
| `bookingService.createOrder()` -> `POST /orders` | MSW |
| `paymentService.initiatePayment()` -> `POST /payments` | MSW |
| `recommendationService.getPersonalized()` -> `GET /recommendations/movies` | MSW |

### 12.3 End-to-End Verification Checklist

- [ ] Auth: Login via Keycloak, JWT decoded, role correctly stored in Zustand
- [ ] Auth: Silent token refresh works (wait 4+ min, make API call, no logout)
- [ ] Auth: Logout clears Keycloak SSO session (verify in Keycloak Admin -> Sessions)
- [ ] Public routes: Movie list, event list, cinema list load without Authorization header
- [ ] Protected routes: `/my-tickets` redirects to login if unauthenticated
- [ ] RBAC: Admin pages return 403 for CUSTOMER role user
- [ ] Showtime: Seat hold countdown timer visible after seat selection
- [ ] Showtime: Navigating away from Booking page releases seats (verify Redis key removed)
- [ ] Booking Saga: Full flow hold -> create order -> payment -> tickets generated
- [ ] Booking Saga: Payment failure -> saga compensation -> seats released -> re-selection shown
- [ ] Payment: VNPay redirect and return handled correctly on `/checkout-success`
- [ ] Admin Dashboard: Data loads for ADMIN, 403 for CUSTOMER
- [ ] Rate Limit: Exceeding request rate shows user-friendly countdown message

---

## Summary of Key Changes

```
+-------------------------+---------------------------------------------------+
| File                    | Change                                            |
+-------------------------+---------------------------------------------------+
| authService.ts          | Full rewrite -> Keycloak OIDC PKCE                |
| main.tsx                | Wrap render in keycloak.init()                    |
| authStore.ts            | Add keycloakId, setToken(); remove id: Long       |
| Login.tsx               | Replace form -> authService.login() redirect      |
| SignUp.tsx               | Replace form -> authService.register() redirect   |
| ForgotPassword.tsx      | Replace form -> authService.forgotPassword()      |
| ResetPassword.tsx       | REMOVE - Keycloak owns this flow                  |
| src/lib/keycloak.ts     | NEW: Keycloak JS singleton                        |
| src/lib/apiClient.ts    | NEW: Shared Axios instance -> :5000 Gateway       |
| src/pages/AuthCallback  | NEW: Post-PKCE redirect handler                   |
| All services/*.ts       | Import shared apiClient (baseURL change only)     |
| showtimeService.ts      | Add holdSeats() / releaseSeats()                  |
| paymentService.ts       | NEW: Payment Service integration                  |
| recommendationService.ts| NEW: Recommendation Service integration           |
| userService.ts          | NEW: User Profile Service integration             |
| ProtectedRoute.tsx      | No change required                                |
| All route pages/*.tsx   | No change (route structure unchanged)             |
| public/silent-check-sso | NEW: Required for keycloak-js silent SSO          |
+-------------------------+---------------------------------------------------+
| .env.development        | VITE_API_BASE_URL=http://localhost:5000/api       |
|                         | VITE_KEYCLOAK_URL=http://localhost:8080           |
|                         | VITE_KEYCLOAK_REALM=cinema-booking                |
|                         | VITE_KEYCLOAK_CLIENT_ID=cinema-frontend           |
+-------------------------+---------------------------------------------------+
```
