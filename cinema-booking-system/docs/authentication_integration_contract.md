# Authentication and Internal Security Integration Contract

Status: integration contract for review and implementation

Updated: 2026-08-06

Scope: Keycloak, API Gateway, Spring Boot services, ASP.NET services, and service-to-service authentication

This document defines the authentication boundary shared by the Spring Boot and
ASP.NET workstreams. Once approved, implementations must follow this contract
instead of relying on framework-specific defaults or trusting unsigned headers.

Related artifacts:

- `architecture_refactor.md` for the high-level target architecture.
- `../backend/shared/contracts/*.openapi.yml` for public and internal HTTP paths.
- `../backend/shared/events/README.md` for the cross-framework RabbitMQ envelope.

## 1. Goals

- Use Keycloak as the only issuer of end-user access and refresh tokens.
- Avoid distributing or rotating a shared JWT signing secret across services.
- Preserve the existing numeric `userId` used by Booking and migrated data.
- Keep public user authentication separate from machine-to-machine authentication.
- Prevent clients from forging identity or role headers.
- Keep `/internal/**` inaccessible from the public Gateway.
- Support signing-key rotation through OIDC discovery and JWKS without changing
  every service configuration.

## 2. Non-Goals

- The shared `X-Internal-Token` is not a replacement for end-user JWTs.
- The API Gateway is not the owner of users, roles, orders, or payments.
- Downstream services must not authorize a request solely from `X-User-Id` or
  `X-User-Roles`.
- This contract does not require mTLS or a service mesh for the first migration.

## 3. Authentication Domains

There are two separate authentication domains. They must not be combined into
one shared static token.

| Domain | Caller | Credential | Validation |
|---|---|---|---|
| Public/user traffic | Browser or mobile client | Keycloak user access token | Gateway and destination service validate OIDC JWT |
| Internal traffic | One backend service calling another | Keycloak client-credentials access token | Destination service validates OIDC JWT and internal audience/scope |

The existing `X-Internal-Token` behavior remains available only as a temporary
compatibility path while Spring services are migrated to client credentials.

## 4. Keycloak Realm Contract

### 4.1 Realm and clients

Use one stable Keycloak realm for the application. Client identifiers may be
adapted to the current realm export, but their responsibilities must remain
separate:

| Client type | Responsibility |
|---|---|
| Public frontend client | Authorization Code flow with PKCE; no client secret in the SPA |
| Backend API audience | Common audience accepted by public backend APIs |
| Confidential service clients | Client Credentials flow for service-to-service calls |
| Administrative client | Keycloak Admin API access for controlled profile provisioning only |

The SPA must not use Resource Owner Password Credentials flow. Keycloak or its
official adapter owns login, Google identity brokering, token refresh, logout,
and session handling.

### 4.2 Canonical application roles

The canonical application roles are:

- `ADMIN`
- `STAFF`
- `CUSTOMER`

`USER` is not a canonical application role. The legacy backend stores
`ROLE_CUSTOMER`, `ROLE_STAFF`, and `ROLE_ADMIN`, while Spring `hasRole(...)`
automatically expects the `ROLE_` authority prefix. Role mapping must therefore
produce:

| Keycloak realm role | Spring authority | ASP.NET role |
|---|---|---|
| `ADMIN` | `ROLE_ADMIN` | `ADMIN` |
| `STAFF` | `ROLE_STAFF` | `STAFF` |
| `CUSTOMER` | `ROLE_CUSTOMER` | `CUSTOMER` |

Keycloak system roles such as `offline_access` and account-management roles
must not become application authorities.

### 4.3 Canonical issuer and container networking

Keycloak must publish one canonical issuer URI. A token issued as
`https://auth.example/realms/cinema-booking` cannot be validated as though its
issuer were `http://keycloak:8080/realms/cinema-booking`.

Browser and container networking may use different routes to reach Keycloak,
but token validation must still compare `iss` with the exact canonical issuer.
Use one of these deployment patterns:

- Configure a canonical Keycloak hostname that both the host and containers can
  resolve through DNS, hosts configuration, or a reverse proxy.
- Configure a library-specific internal metadata/JWKS backchannel URL while
  retaining the canonical issuer value for validation.

Do not solve host/container URL differences by disabling issuer validation.
Keycloak audience mappers must also add the agreed backend audience to access
tokens; accepting any audience is not an alternative.

### 4.4 Required user-token claims

At minimum, user access tokens must expose:

- `iss`: exact Keycloak realm issuer.
- `sub`: Keycloak user UUID.
- `aud`: configured backend API audience.
- `exp`, `iat`: token lifetime metadata.
- `email`: user email when available.
- `realm_access.roles`: realm roles.
- `user_id`: numeric application user ID when provisioning is complete.

The target state is to include `user_id` as a Keycloak custom claim. During the
transition, the Gateway may resolve `sub` to the numeric ID through User Profile
Service and inject `X-User-Id`, subject to the controls in Section 7.

## 5. User ID Mapping

Keycloak `sub` is a UUID string. Existing Booking, Order, Review, Analytics, and
migration data use a numeric `Long userId`. They are not interchangeable.

User Profile Service owns the mapping:

```text
Keycloak subject UUID <-> numeric application user ID
```

Required database guarantees:

- `keycloak_id` is unique and immutable for the life of the profile.
- Numeric `user_id` remains stable across migration and service restarts.
- Profile creation from Keycloak events is idempotent by `keycloak_id`.
- Email is not the identity key and must not be used to correlate bookings.

Provisioning flow:

1. Keycloak creates or federates the user, including Google login.
2. A versioned `user.registered` integration event or an idempotent sync call
   creates the User Profile row.
3. User Profile Service stores the UUID-to-Long mapping.
4. The numeric ID is added to Keycloak as the `user_id` attribute/claim, or the
   Gateway resolves and caches it during the transition.
5. Booking requests are accepted only after mapping succeeds.

An authenticated user whose profile mapping is not ready must receive a
temporary availability error, not be assigned a new unrelated ID. The mapping
process may be retried safely.

## 6. Public Request Flow

```text
SPA
  -> Authorization: Bearer <Keycloak user access token>
API Gateway
  -> validates signature, issuer, audience, lifetime and roles via OIDC/JWKS
  -> removes spoofable identity/internal headers supplied by the client
  -> forwards the original Authorization header
  -> adds correlation and transitional user-context headers
Destination service
  -> validates the same JWT independently
  -> derives authorization roles from validated claims
  -> uses validated `user_id` or the controlled transitional mapping
```

The Gateway must validate all of the following:

- Signing key from Keycloak JWKS.
- Exact issuer. `ValidateIssuer=false` is not acceptable outside temporary local
  diagnosis.
- Expected audience.
- Token expiry and not-before time.
- Required authentication and role policy for the route.

Destination services must be configured as OAuth2/OIDC resource servers. They
store only stable issuer/audience configuration, not Keycloak's private key or
a shared JWT signing secret.

## 7. Gateway Header Contract

Before forwarding a request, the Gateway must remove any client-supplied values
for:

- `X-User-Id`
- `X-Keycloak-Id`
- `X-User-Email`
- `X-User-Roles`
- `X-Internal-Token`

After successful JWT validation, the Gateway may add:

| Header | Purpose | Authorization source? |
|---|---|---|
| `Authorization` | Original Keycloak bearer token | Yes, after destination validation |
| `X-Keycloak-Id` | Convenient copy of validated `sub` | No |
| `X-User-Id` | Transitional numeric-ID resolution | No, unless bound to the validated subject and trusted Gateway path |
| `X-User-Email` | Logging/display context | No |
| `X-User-Roles` | Logging/compatibility context | No |
| `X-Correlation-Id` | Distributed request correlation | No |

A downstream `GatewayAuthenticationHandler` that trusts these headers without
also validating a signed token is not production-safe. Header-only handlers may
exist during local integration only when the service is unreachable outside an
isolated Docker network.

## 8. Signing-Key Rotation and Service Configuration

Keycloak signs JWTs asymmetrically. Only Keycloak owns the private signing key.
Gateway and services retrieve public keys through OIDC discovery/JWKS.

Each service is configured once with values equivalent to:

```text
KEYCLOAK_ISSUER_URI=https://<keycloak-host>/realms/<realm>
KEYCLOAK_AUDIENCE=<backend-api-audience>
```

Expected behavior:

- JWT libraries cache current JWKS keys.
- When Keycloak presents a new `kid`, the library refreshes JWKS.
- Signing-key rotation does not require copying a new secret into every service.
- Unknown keys, invalid issuer, invalid audience, and expired tokens fail closed.
- No JWT or client secret is committed to Git.

This is the reason to use Keycloak/JWKS instead of replacing JWT validation with
one shared internal API token.

## 9. Internal Service-to-Service Authentication

### 9.1 Routing

- Internal endpoints use the `/internal/**` prefix.
- Services call one another directly through private service DNS, not through
  the public Gateway.
- The Gateway must reject every external `/internal/**` request before proxying.
- Production service ports must not be publicly reachable except through the
  Gateway and explicitly approved operational endpoints.

### 9.2 Target mechanism: client credentials

Each calling service uses a confidential Keycloak client to obtain a short-lived
machine token. The destination validates it through the same issuer/JWKS path.

Machine tokens must contain:

- A client/service subject.
- An internal API audience accepted by the destination.
- A client role or scope granting only the required internal operations.
- A short expiry.

If a service client secret is rotated, only that calling service needs the new
credential. Receiving services continue validating Keycloak signatures through
JWKS and require no secret update.

Internal authorization must be least privilege. A service token must not inherit
`ADMIN`, `STAFF`, or `CUSTOMER` merely to access internal APIs.

### 9.3 Transitional mechanism

Existing Spring contracts use:

```text
Header: X-Internal-Token
Environment variable: INTERNAL_API_TOKEN
```

`X-Internal-Token` is the canonical compatibility header. Do not introduce the
alternative `X-Internal-Api-Key` name during migration.

The shared token must be constant-time compared, stored outside Git, blocked at
the Gateway, and replaced by client credentials service by service. Rotating a
shared token requires coordinated configuration updates, so it does not solve
the key-rotation requirement and is not the final architecture.

## 10. Calls Requiring User Context

Most current `/internal/**` reads and seat commands need service identity, not
end-user authorization. They use the caller's machine token.

If an internal operation later needs acting-user context:

- The service token authenticates the calling service.
- The acting user ID is explicit context and cannot grant permission by itself.
- The destination either validates the original user token through a supported
  token-exchange/on-behalf-of flow or trusts only a signed claim produced by an
  approved internal issuer.

Do not place two unrelated bearer tokens in the same `Authorization` header, and
do not authorize a user-sensitive internal action from `X-User-Id` alone.

## 11. Authorization Responsibilities

The Gateway performs coarse route authorization and rate limiting. Destination
services perform domain authorization close to the protected operation.

Examples:

- Gateway requires `ADMIN` for public cinema/movie management routes.
- Facility/Catalog still enforce `ADMIN` on write commands.
- Showtime permits `ADMIN` or `STAFF` only where its contract requires it.
- Booking derives the customer ID from the validated identity context, not from
  an arbitrary request body or query parameter.

Gateway authorization is not a reason to remove service authorization.

## 12. Failure Semantics

| Condition | Expected result |
|---|---|
| Missing or invalid token on protected public route | `401 Unauthorized` |
| Valid token without required role | `403 Forbidden` |
| External request to `/internal/**` through Gateway | `403 Forbidden` or hidden `404` |
| Missing/invalid machine credential on internal endpoint | `401 Unauthorized` |
| Valid machine token without required internal scope | `403 Forbidden` |
| Authenticated user mapping temporarily unavailable | `503 Service Unavailable` with stable error code |
| Unknown JWKS key after refresh or invalid issuer/audience | `401 Unauthorized` |

Authentication and profile-resolution failures must fail closed. They must not
silently create a user, default to `CUSTOMER`, or accept caller-supplied IDs.

## 13. Logging and Audit

- Never log access tokens, refresh tokens, client secrets, authorization headers,
  or the shared compatibility token.
- Log `X-Correlation-Id`, Keycloak subject, internal numeric ID when resolved,
  route, decision, and error code.
- Audit role changes, profile mapping changes, login failures, administrative
  operations, and client-credential failures.
- Correlation IDs must propagate through HTTP and RabbitMQ event envelopes.

## 14. Required Security Tests

The integrated stack is not ready for traffic until these tests pass:

1. Valid `CUSTOMER`, `STAFF`, and `ADMIN` tokens map to the expected authorities.
2. Invalid issuer, audience, signature, expiry, and not-before values are rejected.
3. Forged `X-User-Id` or `X-User-Roles` without a valid token is rejected.
4. Gateway strips spoofed identity and internal-token headers before forwarding.
5. Services reject direct protected calls that contain headers but no valid JWT.
6. Gateway blocks every `/internal/**` route.
7. Internal endpoints reject missing or insufficient machine credentials.
8. Client-credentials tokens cannot access user/admin routes unless explicitly
   authorized.
9. Keycloak signing-key rotation succeeds through JWKS without service secret
   changes.
10. Existing and Google-federated users resolve to one stable numeric user ID.
11. Duplicate provisioning events do not create duplicate profiles.
12. Logs and error responses contain no token or secret material.

## 15. Migration Sequence

1. Freeze realm name, role names, audiences, claim names, and header names.
2. Import and verify the Keycloak realm without committing operational secrets.
3. Make User Profile provisioning and UUID-to-Long mapping idempotent.
4. Configure Gateway issuer/audience validation and remove
   `ValidateIssuer=false`.
5. Make Gateway strip spoofable headers and forward the original bearer token.
6. Configure Spring and ASP.NET services as resource servers and map canonical
   roles.
7. Keep `X-Internal-Token` only for the current Spring compatibility calls.
8. Add Keycloak confidential clients and migrate internal callers one at a time
   to client credentials.
9. Close direct public access to service ports.
10. Run the security tests, full runtime smoke, event-flow tests, and rollback
    rehearsal before switching frontend traffic.

Rollback may temporarily re-enable the compatibility internal token, but it must
never fall back to accepting unsigned user identity headers on public routes.

## 16. Definition of Done

Authentication integration is complete when:

- Keycloak is the only end-user token issuer.
- Gateway and all protected services validate issuer, audience, lifetime, and
  JWKS signature.
- No service requires a shared JWT signing secret.
- Roles are consistently `ADMIN`, `STAFF`, and `CUSTOMER`.
- Every authenticated booking user resolves to one stable numeric ID.
- Public callers cannot reach `/internal/**` or forge identity headers.
- Internal calls are authenticated by client credentials, except explicitly
  tracked compatibility paths.
- Signing-key rotation and all tests in Section 14 pass.
