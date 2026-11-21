import logging
import re

PROBE_PATHS = frozenset({"/health", "/healthz", "/ready", "/readyz", "/live", "/livez"})
_ACCESS_LOG_RE = re.compile(r'"[A-Z]+\s+([^\s"]+)\s+HTTP/[^"]+"\s+(\d{3})')


def _is_probe_path(raw_path: str) -> bool:
    path = raw_path.split("?", 1)[0].rstrip("/") or "/"
    return path in PROBE_PATHS or path.startswith("/health/")


class HealthProbeAccessFilter(logging.Filter):
    """Suppress successful (<400) health-probe access logs while preserving error logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        raw_path: str | None = None
        raw_status: object | None = None

        if isinstance(record.args, tuple) and len(record.args) >= 5:
            raw_path = str(record.args[2])
            raw_status = record.args[4]
        else:
            match = _ACCESS_LOG_RE.search(record.getMessage())
            if match:
                raw_path = match.group(1)
                raw_status = match.group(2)

        if raw_path is None or not _is_probe_path(raw_path):
            return True

        try:
            status_code = int(raw_status)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return True

        return status_code >= 400


def configure_access_log_filters() -> None:
    """Attach HealthProbeAccessFilter idempotently to Uvicorn's access logger."""
    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, HealthProbeAccessFilter) for f in access_logger.filters):
        access_logger.addFilter(HealthProbeAccessFilter())
