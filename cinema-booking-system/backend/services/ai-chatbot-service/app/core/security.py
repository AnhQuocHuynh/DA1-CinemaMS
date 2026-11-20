import base64
from dataclasses import dataclass, field
import hashlib
import hmac
import inspect
import json
import logging
import time
from typing import Any, Callable
import uuid

from fastapi import Header, HTTPException

from app.core.config import settings
from app.services import downstream_client

logger = logging.getLogger("cinebot.security")


@dataclass
class UserContext:
    user_id: int | None = None
    keycloak_id: str | None = None
    roles: list[str] = field(default_factory=list)
    session_token: str | None = None
    raw_token: str | None = None
    jwt_verified: bool = False
    booking_lookup_allowed: bool | None = None

    @property
    def is_authenticated(self) -> bool:
        return self.user_id is not None

    @property
    def can_lookup_bookings(self) -> bool:
        if self.user_id is None or self.user_id <= 0:
            return False
        if self.booking_lookup_allowed is not None:
            return bool(self.booking_lookup_allowed)
        if settings.CINEMA_SECURITY_JWT_ENABLED:
            return self.jwt_verified
        return True


def _b64url_decode(segment: str) -> bytes:
    padded = segment + "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _b64url_to_int(segment: str) -> int:
    return int.from_bytes(_b64url_decode(segment), "big")


def _parse_positive_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            parsed = int(stripped)
            return parsed if parsed > 0 else None
    return None


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.strip().split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
        return parts[1].strip()
    return None


class ActorResolver:
    """Resolve authenticated actor context via Keycloak JWT verification or gateway headers."""

    def __init__(
        self,
        token_decoder: Callable[[str], Any] | None = None,
        hs256_secret: str | None = None,
    ) -> None:
        self.token_decoder = token_decoder
        self.hs256_secret = hs256_secret
        self._jwks_cache: dict[str, dict[str, Any]] = {}

    def clear_jwks_cache(self) -> None:
        self._jwks_cache.clear()

    @staticmethod
    def _jwk_set_url() -> str:
        if settings.KEYCLOAK_JWK_SET_URI.strip():
            return settings.KEYCLOAK_JWK_SET_URI.strip()
        issuer = settings.KEYCLOAK_ISSUER_URI.strip().rstrip("/")
        if issuer:
            return f"{issuer}/protocol/openid-connect/certs"
        return ""

    @staticmethod
    def _parse_jwt_parts(token: str) -> tuple[dict[str, Any], dict[str, Any], bytes, bytes]:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT segment count")
        header = json.loads(_b64url_decode(parts[0]).decode("utf-8"))
        payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
        if not isinstance(header, dict) or not isinstance(payload, dict):
            raise ValueError("Invalid JWT JSON structure")
        signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
        signature = _b64url_decode(parts[2])
        return header, payload, signing_input, signature

    async def _fetch_jwks(self, jwks_url: str) -> dict[str, dict[str, Any]]:
        try:
            resp = await downstream_client.get_with_resilience("keycloak", jwks_url)
            body = resp.json()
        except Exception as exc:
            logger.warning("Failed to fetch JWKS from %s: %s", jwks_url, exc)
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc

        keys = body.get("keys") if isinstance(body, dict) else None
        if not isinstance(keys, list):
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

        parsed: dict[str, dict[str, Any]] = {}
        for jwk in keys:
            if not isinstance(jwk, dict):
                continue
            kid = jwk.get("kid")
            if kid:
                parsed[str(kid)] = jwk
            elif "__default__" not in parsed:
                parsed["__default__"] = jwk
        self._jwks_cache = parsed
        return parsed

    @staticmethod
    def _verify_rs256_with_jwk(
        signing_input: bytes, signature: bytes, jwk: dict[str, Any]
    ) -> None:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers

        n = _b64url_to_int(str(jwk["n"]))
        e = _b64url_to_int(str(jwk["e"]))
        public_key = RSAPublicNumbers(e=e, n=n).public_key()
        public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())

    @staticmethod
    def _verify_hs256(signing_input: bytes, signature: bytes, secret: str) -> None:
        expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError("HS256 signature mismatch")

    @staticmethod
    def _validate_claims(claims: dict[str, Any], require_exp: bool) -> None:
        now = time.time()
        exp = claims.get("exp")
        if exp is None:
            if require_exp:
                raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")
        else:
            try:
                if float(exp) <= now:
                    raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc

        nbf = claims.get("nbf")
        if nbf is not None:
            try:
                if float(nbf) > now:
                    raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc

        expected_iss = settings.KEYCLOAK_ISSUER_URI.strip()
        if expected_iss and claims.get("iss") != expected_iss:
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

        expected_aud = settings.KEYCLOAK_AUDIENCE.strip()
        if expected_aud:
            aud = claims.get("aud")
            if isinstance(aud, str):
                aud_ok = aud == expected_aud
            elif isinstance(aud, list):
                aud_ok = expected_aud in aud
            else:
                aud_ok = False
            if not aud_ok:
                raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

    async def verify_token(self, token: str) -> dict[str, Any]:
        if self.token_decoder is not None:
            try:
                decoded = self.token_decoder(token)
                if inspect.isawaitable(decoded):
                    decoded = await decoded
                if not isinstance(decoded, dict):
                    raise ValueError("Decoded token must be a dict")
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc
            self._validate_claims(decoded, require_exp=settings.CINEMA_SECURITY_JWT_ENABLED)
            return decoded

        try:
            header, payload, signing_input, signature = self._parse_jwt_parts(token)
        except Exception as exc:
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc

        alg = str(header.get("alg") or "").upper()
        if self.hs256_secret and alg == "HS256":
            try:
                self._verify_hs256(signing_input, signature, self.hs256_secret)
            except Exception as exc:
                raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc
            self._validate_claims(payload, require_exp=settings.CINEMA_SECURITY_JWT_ENABLED)
            return payload

        if alg != "RS256":
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

        jwks_url = self._jwk_set_url()
        if not jwks_url:
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

        kid = str(header.get("kid") or "__default__")
        jwk = self._jwks_cache.get(kid)
        if jwk is None:
            jwks = await self._fetch_jwks(jwks_url)
            jwk = jwks.get(kid)
        if jwk is None:
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

        try:
            self._verify_rs256_with_jwk(signing_input, signature, jwk)
        except Exception as exc:
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc

        self._validate_claims(payload, require_exp=settings.CINEMA_SECURITY_JWT_ENABLED)
        return payload

    @staticmethod
    def _extract_roles(claims: dict[str, Any], header_roles: str | None) -> list[str]:
        roles: list[str] = []
        realm_access = claims.get("realm_access")
        if isinstance(realm_access, dict):
            raw_roles = realm_access.get("roles")
            if isinstance(raw_roles, list):
                for role in raw_roles:
                    if isinstance(role, str) and role.strip():
                        normalized = role.strip().upper()
                        if normalized not in roles:
                            roles.append(normalized)
        if not roles and header_roles:
            for role in header_roles.split(","):
                if role.strip():
                    normalized = role.strip().upper()
                    if normalized not in roles:
                        roles.append(normalized)
        return roles

    async def resolve(
        self,
        authorization: str | None = None,
        x_user_id: str | None = None,
        x_keycloak_id: str | None = None,
        x_user_roles: str | None = None,
        x_session_token: str | None = None,
    ) -> UserContext:
        raw_token = _extract_bearer_token(authorization)
        header_uid = _parse_positive_int(x_user_id)

        if settings.CINEMA_SECURITY_JWT_ENABLED:
            if not raw_token:
                raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

            claims = await self.verify_token(raw_token)
            sub = str(claims["sub"]) if claims.get("sub") is not None else None
            claim_uid = (
                _parse_positive_int(claims.get("user_id"))
                or _parse_positive_int(claims.get("internal_user_id"))
                or _parse_positive_int(sub)
            )

            if claim_uid is not None:
                if header_uid is not None and header_uid != claim_uid:
                    raise HTTPException(status_code=403, detail="USER_ID_MISMATCH")
                resolved_uid = claim_uid
            else:
                resolved_uid = await downstream_client.resolve_user_id(sub) if sub else None
                if resolved_uid is None and header_uid is not None:
                    if x_keycloak_id and sub and x_keycloak_id != sub:
                        raise HTTPException(status_code=403, detail="USER_ID_MISMATCH")
                    resolved_uid = header_uid
                if resolved_uid is None:
                    raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

            roles = self._extract_roles(claims, x_user_roles)
            return UserContext(
                user_id=resolved_uid,
                keycloak_id=sub or x_keycloak_id,
                roles=roles,
                session_token=x_session_token,
                raw_token=raw_token,
                jwt_verified=True,
            )

        claims: dict[str, Any] = {}
        jwt_verified = False
        if raw_token:
            if (
                self.token_decoder is not None
                or self.hs256_secret is not None
                or self._jwk_set_url()
            ):
                claims = await self.verify_token(raw_token)
                jwt_verified = True
            else:
                try:
                    _, claims, _, _ = self._parse_jwt_parts(raw_token)
                except Exception:
                    claims = {}

        sub = str(claims["sub"]) if claims.get("sub") is not None else None
        claim_uid = (
            _parse_positive_int(claims.get("user_id"))
            or _parse_positive_int(claims.get("internal_user_id"))
            or _parse_positive_int(sub)
        )
        if jwt_verified and claim_uid is not None and header_uid is not None and header_uid != claim_uid:
            raise HTTPException(status_code=403, detail="USER_ID_MISMATCH")

        resolved_uid = claim_uid or header_uid
        if resolved_uid is None and sub:
            resolved_uid = await downstream_client.resolve_user_id(sub)
        if resolved_uid is None and settings.DEV_ACTOR_ID and settings.DEV_ACTOR_ID > 0:
            resolved_uid = settings.DEV_ACTOR_ID

        keycloak_id = sub or x_keycloak_id
        roles = self._extract_roles(claims, x_user_roles)
        token = x_session_token or (None if resolved_uid else uuid.uuid4().hex)
        return UserContext(
            user_id=resolved_uid,
            keycloak_id=keycloak_id,
            roles=roles,
            session_token=token,
            raw_token=raw_token,
            jwt_verified=jwt_verified,
        )


actor_resolver = ActorResolver()


async def get_user_context(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    x_keycloak_id: str | None = Header(default=None),
    x_user_roles: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None),
) -> UserContext:
    """Build the caller context from a verified Keycloak JWT and/or gateway headers."""
    return await actor_resolver.resolve(
        authorization=authorization,
        x_user_id=x_user_id,
        x_keycloak_id=x_keycloak_id,
        x_user_roles=x_user_roles,
        x_session_token=x_session_token,
    )

