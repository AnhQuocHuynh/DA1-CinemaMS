import logging

from app.core.config import Settings
from app.core.logging_filters import HealthProbeAccessFilter, configure_access_log_filters


def _make_access_record(
    method: str,
    path: str,
    status: int,
    *,
    formatted_only: bool = False,
) -> logging.LogRecord:
    if formatted_only:
        msg = f'172.18.0.18:50306 - "{method} {path} HTTP/1.1" {status}'
        return logging.LogRecord(
            name="uvicorn.access",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg=msg,
            args=(),
            exc_info=None,
        )
    return logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg='%s - "%s %s HTTP/%s" %d',
        args=("172.18.0.18:50306", method, path, "1.1", status),
        exc_info=None,
    )


def test_suppresses_healthy_probe_requests() -> None:
    flt = HealthProbeAccessFilter()
    assert flt.filter(_make_access_record("GET", "/health", 200)) is False
    assert flt.filter(_make_access_record("GET", "/health?detail=1", 200)) is False
    assert flt.filter(_make_access_record("GET", "/health/ready", 200)) is False
    assert flt.filter(_make_access_record("GET", "/healthz", 200)) is False
    assert flt.filter(_make_access_record("GET", "/readyz", 204)) is False


def test_keeps_error_probe_requests() -> None:
    flt = HealthProbeAccessFilter()
    assert flt.filter(_make_access_record("GET", "/health", 400)) is True
    assert flt.filter(_make_access_record("GET", "/health", 404)) is True
    assert flt.filter(_make_access_record("POST", "/health", 405)) is True
    assert flt.filter(_make_access_record("GET", "/health", 500)) is True
    assert flt.filter(_make_access_record("GET", "/health", 503)) is True


def test_keeps_non_probe_requests() -> None:
    flt = HealthProbeAccessFilter()
    assert flt.filter(_make_access_record("POST", "/api/chat/stream", 200)) is True
    assert flt.filter(_make_access_record("DELETE", "/api/chat/sessions/123", 204)) is True
    assert flt.filter(_make_access_record("POST", "/internal/chat/reindex", 200)) is True


def test_formatted_string_message_fallback() -> None:
    flt = HealthProbeAccessFilter()
    assert flt.filter(_make_access_record("GET", "/health", 200, formatted_only=True)) is False
    assert flt.filter(_make_access_record("GET", "/health", 503, formatted_only=True)) is True
    assert flt.filter(_make_access_record("POST", "/api/chat/stream", 200, formatted_only=True)) is True


def test_configure_access_log_filters_is_idempotent() -> None:
    access_logger = logging.getLogger("uvicorn.access")
    original_filters = list(access_logger.filters)
    try:
        access_logger.filters = [
            f for f in access_logger.filters if not isinstance(f, HealthProbeAccessFilter)
        ]
        configure_access_log_filters()
        configure_access_log_filters()
        attached = [f for f in access_logger.filters if isinstance(f, HealthProbeAccessFilter)]
        assert len(attached) == 1
    finally:
        access_logger.filters = original_filters


def test_cors_allowed_origins_resolves_from_frontend_url_and_csv() -> None:
    s_default = Settings(FRONTEND_URL="http://localhost:5173/", CORS_ALLOWED_ORIGINS="")
    assert s_default.cors_allowed_origins_list == ["http://localhost:5173"]

    s_csv = Settings(
        FRONTEND_URL="http://localhost:5173",
        CORS_ALLOWED_ORIGINS=" https://cinema.example.com/ , http://localhost:3000 ",
    )
    assert s_csv.cors_allowed_origins_list == [
        "https://cinema.example.com",
        "http://localhost:3000",
    ]

