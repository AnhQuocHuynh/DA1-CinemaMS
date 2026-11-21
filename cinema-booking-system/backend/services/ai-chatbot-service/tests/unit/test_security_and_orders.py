import base64
import hashlib
import hmac
import json
import time

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import HTTPException
import pytest

from app.core import security
from app.core.security import ActorResolver, UserContext, get_user_context
from app.services import cache_service, downstream_client, guardrails, intent_router


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _int_to_b64url(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return _b64url(raw)


def _make_hs256_jwt(payload: dict, secret: str) -> str:
    header_b64 = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(sig)}"


def _make_rs256_jwt(payload: dict, private_key, kid: str = "test-kid") -> str:
    header_b64 = _b64url(
        json.dumps({"alg": "RS256", "typ": "JWT", "kid": kid}).encode("utf-8")
    )
    payload_b64 = _b64url(json.dumps(payload).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    return f"{header_b64}.{payload_b64}.{_b64url(sig)}"


class _FakeResponse:
    def __init__(self, payload, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class _FakeHttpClient:
    def __init__(self, handler) -> None:
        self.handler = handler
        self.calls: list[tuple[str, dict | None, dict | None]] = []

    async def get(self, url: str, params=None, headers=None):
        self.calls.append((url, params, headers))
        return self.handler(url, params, headers)


@pytest.mark.asyncio
async def test_actor_resolver_jwt_enabled_rs256_jwks_and_claims(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub_numbers = private_key.public_key().public_numbers()
    jwk = {
        "kty": "RSA",
        "kid": "kc-key-1",
        "use": "sig",
        "alg": "RS256",
        "n": _int_to_b64url(pub_numbers.n),
        "e": _int_to_b64url(pub_numbers.e),
    }

    http = _FakeHttpClient(lambda url, params, headers: _FakeResponse({"keys": [jwk]}))
    monkeypatch.setattr(downstream_client, "_client", http)
    monkeypatch.setattr(security.settings, "CINEMA_SECURITY_JWT_ENABLED", True)
    monkeypatch.setattr(
        security.settings,
        "KEYCLOAK_ISSUER_URI",
        "http://localhost:8080/realms/cinema-booking",
    )
    monkeypatch.setattr(security.settings, "KEYCLOAK_AUDIENCE", "cinema-api")
    monkeypatch.setattr(
        security.settings,
        "KEYCLOAK_JWK_SET_URI",
        "http://keycloak:8080/realms/cinema-booking/protocol/openid-connect/certs",
    )

    resolver = ActorResolver()
    now = int(time.time())
    token = _make_rs256_jwt(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "user_id": 42,
            "iss": "http://localhost:8080/realms/cinema-booking",
            "aud": ["cinema-api", "account"],
            "exp": now + 300,
            "realm_access": {"roles": ["customer", "USER"]},
        },
        private_key,
        kid="kc-key-1",
    )

    ctx = await resolver.resolve(authorization=f"Bearer {token}")
    assert ctx.user_id == 42
    assert ctx.keycloak_id == "11111111-1111-1111-1111-111111111111"
    assert ctx.roles == ["CUSTOMER", "USER"]
    assert ctx.raw_token == token
    assert ctx.jwt_verified is True
    assert ctx.can_lookup_bookings is True
    assert len(http.calls) == 1

    # Second call uses cached JWKS without another HTTP fetch
    ctx2 = await resolver.resolve(authorization=f"Bearer {token}")
    assert ctx2.user_id == 42
    assert len(http.calls) == 1

    # Spoofed X-User-Id differing from verified JWT user_id raises 403
    with pytest.raises(HTTPException) as mismatch:
        await resolver.resolve(authorization=f"Bearer {token}", x_user_id="999")
    assert mismatch.value.status_code == 403


@pytest.mark.asyncio
async def test_actor_resolver_jwt_enabled_rejects_missing_expired_wrong_aud_or_iss(monkeypatch):
    secret = "test-jwt-secret"
    resolver = ActorResolver(hs256_secret=secret)
    monkeypatch.setattr(security.settings, "CINEMA_SECURITY_JWT_ENABLED", True)
    monkeypatch.setattr(
        security.settings,
        "KEYCLOAK_ISSUER_URI",
        "http://localhost:8080/realms/cinema-booking",
    )
    monkeypatch.setattr(security.settings, "KEYCLOAK_AUDIENCE", "cinema-api")

    # Missing token -> anonymous guest UserContext ignoring spoofed headers
    anon_ctx = await resolver.resolve(
        x_user_id="42",
        x_keycloak_id="kc-spoof",
        x_user_roles="ADMIN,STAFF",
        x_session_token="guest-sess-1",
    )
    assert anon_ctx.user_id is None
    assert anon_ctx.keycloak_id is None
    assert anon_ctx.roles == []
    assert anon_ctx.session_token == "guest-sess-1"
    assert anon_ctx.raw_token is None
    assert anon_ctx.jwt_verified is False
    assert anon_ctx.is_authenticated is False
    assert anon_ctx.can_lookup_bookings is False

    with pytest.raises(HTTPException) as anon_exc:
        security.ensure_authenticated_user(anon_ctx)
    assert anon_exc.value.status_code == 401

    # Malformed Authorization header -> 401
    for bad_auth in ("Basic abc", "Bearer "):
        with pytest.raises(HTTPException) as bad_auth_exc:
            await resolver.resolve(authorization=bad_auth)
        assert bad_auth_exc.value.status_code == 401

    now = int(time.time())
    base_claims = {
        "sub": "22222222-2222-2222-2222-222222222222",
        "user_id": 7,
        "iss": "http://localhost:8080/realms/cinema-booking",
        "aud": "cinema-api",
        "exp": now + 300,
    }

    # Expired token -> 401
    expired = _make_hs256_jwt({**base_claims, "exp": now - 10}, secret)
    with pytest.raises(HTTPException) as exp_exc:
        await resolver.resolve(authorization=f"Bearer {expired}")
    assert exp_exc.value.status_code == 401

    # Wrong audience -> 401
    wrong_aud = _make_hs256_jwt({**base_claims, "aud": "other-api"}, secret)
    with pytest.raises(HTTPException) as aud_exc:
        await resolver.resolve(authorization=f"Bearer {wrong_aud}")
    assert aud_exc.value.status_code == 401

    # Wrong issuer -> 401
    wrong_iss = _make_hs256_jwt({**base_claims, "iss": "http://evil/realm"}, secret)
    with pytest.raises(HTTPException) as iss_exc:
        await resolver.resolve(authorization=f"Bearer {wrong_iss}")
    assert iss_exc.value.status_code == 401

    # Bad signature -> 401
    bad_sig = _make_hs256_jwt(base_claims, "wrong-secret")
    with pytest.raises(HTTPException) as sig_exc:
        await resolver.resolve(authorization=f"Bearer {bad_sig}")
    assert sig_exc.value.status_code == 401


@pytest.mark.asyncio
async def test_actor_resolver_resolves_user_id_from_identity_service_when_claim_missing(monkeypatch):
    secret = "test-jwt-secret"
    resolver = ActorResolver(hs256_secret=secret)
    monkeypatch.setattr(security.settings, "CINEMA_SECURITY_JWT_ENABLED", True)
    monkeypatch.setattr(security.settings, "KEYCLOAK_ISSUER_URI", "")
    monkeypatch.setattr(security.settings, "KEYCLOAK_AUDIENCE", "cinema-api")

    http = _FakeHttpClient(
        lambda url, params, headers: _FakeResponse(88)
        if "/internal/users/resolve" in url and (params or {}).get("keycloakId") == "kc-uuid-88"
        else _FakeResponse({}, status_code=404)
    )
    monkeypatch.setattr(downstream_client, "_client", http)

    token = _make_hs256_jwt(
        {"sub": "kc-uuid-88", "aud": "cinema-api", "exp": int(time.time()) + 300},
        secret,
    )
    ctx = await resolver.resolve(authorization=f"Bearer {token}")
    assert ctx.user_id == 88
    assert ctx.keycloak_id == "kc-uuid-88"
    assert ctx.jwt_verified is True

    # Unresolvable subject without X-User-Id -> 401
    missing_http = _FakeHttpClient(lambda url, params, headers: _FakeResponse({}, status_code=404))
    monkeypatch.setattr(downstream_client, "_client", missing_http)
    with pytest.raises(HTTPException) as unresolvable:
        await resolver.resolve(authorization=f"Bearer {token}")
    assert unresolvable.value.status_code == 401


@pytest.mark.asyncio
async def test_actor_resolver_disabled_mode_supports_headers_guest_and_dev_actor(monkeypatch):
    monkeypatch.setattr(security.settings, "CINEMA_SECURITY_JWT_ENABLED", False)
    monkeypatch.setattr(security.settings, "DEV_ACTOR_ID", None)

    header_ctx = await get_user_context(
        authorization=None,
        x_user_id="15",
        x_keycloak_id="kc-15",
        x_user_roles="customer, staff",
        x_session_token=None,
    )
    assert header_ctx.user_id == 15
    assert header_ctx.roles == ["CUSTOMER", "STAFF"]
    assert header_ctx.can_lookup_bookings is True

    guest_ctx = await get_user_context(
        authorization=None,
        x_user_id=None,
        x_keycloak_id=None,
        x_user_roles=None,
        x_session_token=None,
    )
    assert guest_ctx.user_id is None
    assert guest_ctx.session_token is not None
    assert guest_ctx.can_lookup_bookings is False

    monkeypatch.setattr(security.settings, "DEV_ACTOR_ID", 99)
    dev_ctx = await get_user_context(
        authorization=None,
        x_user_id=None,
        x_keycloak_id=None,
        x_user_roles=None,
        x_session_token=None,
    )
    assert dev_ctx.user_id == 99


@pytest.mark.asyncio
async def test_get_user_orders_and_authorization_gate(monkeypatch):
    calls: list[tuple[str, dict | None]] = []

    def handler(url, params, headers):
        calls.append((url, headers))
        return _FakeResponse(
            [
                {
                    "id": 701,
                    "displayTitle": "Dune: Part Two",
                    "startTime": "2026-11-18T19:30:00",
                    "cinemaName": "Cinema Central",
                    "roomName": "IMAX",
                    "status": "PAID",
                    "seatLabels": ["E5", "E6"],
                    "finalAmount": 280000,
                }
            ]
        )

    monkeypatch.setattr(downstream_client, "_client", _FakeHttpClient(handler))

    # Zero or None user_id never triggers HTTP call
    assert await downstream_client.get_user_orders(None) == []
    assert await downstream_client.get_user_orders(0) == []
    assert calls == []

    # Guest user gated in intent_router
    guest = UserContext(user_id=None, session_token="guest-1")
    ctx_guest, _ = await intent_router.build_context_and_sources(
        "ORDER_QUERY", "Show my orders", user=guest
    )
    assert "sign in" in (ctx_guest or "").lower()
    assert calls == []

    ctx_guest_vi, _ = await intent_router.build_context_and_sources(
        "ORDER_QUERY", "Vé của tôi đâu?", user=guest
    )
    assert "đăng nhập" in (ctx_guest_vi or "").lower()
    assert calls == []

    # Unverified user when JWT is enabled is also gated
    monkeypatch.setattr(security.settings, "CINEMA_SECURITY_JWT_ENABLED", True)
    unverified_user = UserContext(user_id=42, jwt_verified=False)
    ctx_unverified, _ = await intent_router.build_context_and_sources(
        "ORDER_QUERY", "Show my orders", user=unverified_user
    )
    assert "sign in" in (ctx_unverified or "").lower()
    assert calls == []

    # Verified user receives live order context and forwards token
    verified_user = UserContext(user_id=42, raw_token="jwt-abc", jwt_verified=True)
    ctx_auth, sources = await intent_router.build_context_and_sources(
        "ORDER_QUERY", "Show my orders", user=verified_user
    )
    assert sources == []
    assert "Order #701" in (ctx_auth or "")
    assert "Dune: Part Two" in (ctx_auth or "")
    assert "E5, E6" in (ctx_auth or "")
    assert "PAID" in (ctx_auth or "")
    assert calls[0][0].endswith("/api/orders/users/42")
    assert calls[0][1] == {"X-User-Id": "42", "Authorization": "Bearer jwt-abc"}


@pytest.mark.asyncio
async def test_order_intent_classification_and_cache_bypass(monkeypatch):
    async def offline_gen(prompt, **kwargs):
        return ""

    monkeypatch.setattr(guardrails.llm_client, "generate", offline_gen)

    for q in (
        "Show my orders",
        "Where are my tickets?",
        "Check my booking status",
        "Vé của tôi đâu?",
        "Kiểm tra đơn hàng của tôi",
        "Lịch sử đặt vé của mình",
    ):
        assert await guardrails.classify_intent(q) == "ORDER_QUERY"
        assert cache_service.should_bypass(q) is True
        assert intent_router.wants_orders(q) is True
