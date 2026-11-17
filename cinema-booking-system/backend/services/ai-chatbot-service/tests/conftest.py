import inspect
import sys
import types
from importlib.util import find_spec
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _install_missing_shims() -> None:
    """Provide minimal stubs only when optional runtime deps are absent locally."""
    if find_spec("fastapi") is None and "fastapi" not in sys.modules:
        fastapi_mod = types.ModuleType("fastapi")

        class HTTPException(Exception):
            def __init__(self, status_code: int, detail: str = "") -> None:
                self.status_code = status_code
                self.detail = detail
                super().__init__(detail)

        class APIRouter:
            def __init__(self, *args, **kwargs) -> None:
                pass

            def include_router(self, *args, **kwargs) -> None:
                pass

            def _decorator(self, *args, **kwargs):
                return lambda fn: fn

            get = post = put = delete = _decorator

        class FastAPI(APIRouter):
            def __init__(self, *args, **kwargs) -> None:
                super().__init__(*args, **kwargs)
                self.state = types.SimpleNamespace()

            def add_middleware(self, *args, **kwargs) -> None:
                pass

            def exception_handler(self, *args, **kwargs):
                return lambda fn: fn

        def Depends(dep=None):
            return dep

        def Header(default=None, **_kwargs):
            return default

        class Request:
            def __init__(self) -> None:
                self.app = types.SimpleNamespace(state=types.SimpleNamespace(redis=None))

        fastapi_mod.HTTPException = HTTPException
        fastapi_mod.APIRouter = APIRouter
        fastapi_mod.FastAPI = FastAPI
        fastapi_mod.Depends = Depends
        fastapi_mod.Header = Header
        fastapi_mod.Request = Request
        sys.modules["fastapi"] = fastapi_mod

        fastapi_responses_mod = types.ModuleType("fastapi.responses")

        class JSONResponse:
            def __init__(self, status_code: int = 200, content=None) -> None:
                self.status_code = status_code
                self.content = content

        class StreamingResponse:
            def __init__(self, content, media_type: str | None = None, status_code: int = 200) -> None:
                self.body_iterator = content
                self.media_type = media_type
                self.status_code = status_code

        fastapi_responses_mod.JSONResponse = JSONResponse
        fastapi_responses_mod.StreamingResponse = StreamingResponse
        fastapi_mod.responses = fastapi_responses_mod
        sys.modules["fastapi.responses"] = fastapi_responses_mod

        fastapi_mw_mod = types.ModuleType("fastapi.middleware")
        fastapi_cors_mod = types.ModuleType("fastapi.middleware.cors")

        class CORSMiddleware:
            pass

        fastapi_cors_mod.CORSMiddleware = CORSMiddleware
        fastapi_mw_mod.cors = fastapi_cors_mod
        fastapi_mod.middleware = fastapi_mw_mod
        sys.modules["fastapi.middleware"] = fastapi_mw_mod
        sys.modules["fastapi.middleware.cors"] = fastapi_cors_mod

    if find_spec("pydantic_settings") is None and "pydantic_settings" not in sys.modules:
        from pydantic import BaseModel

        ps_mod = types.ModuleType("pydantic_settings")

        class BaseSettings(BaseModel):
            pass

        ps_mod.BaseSettings = BaseSettings
        ps_mod.SettingsConfigDict = dict
        sys.modules["pydantic_settings"] = ps_mod

    if find_spec("asyncpg") is None and "asyncpg" not in sys.modules:
        asyncpg_mod = types.ModuleType("asyncpg")

        async def _connect(*_args, **_kwargs):
            raise RuntimeError("asyncpg is not installed in this environment")

        asyncpg_mod.connect = _connect
        sys.modules["asyncpg"] = asyncpg_mod

    if find_spec("sqlalchemy") is None and "sqlalchemy" not in sys.modules:
        sa_mod = types.ModuleType("sqlalchemy")
        sa_ext_mod = types.ModuleType("sqlalchemy.ext")
        sa_async_mod = types.ModuleType("sqlalchemy.ext.asyncio")

        def text(sql: str) -> str:
            return sql

        class AsyncSession:
            pass

        class _DummyEngine:
            async def dispose(self) -> None:
                return None

        def create_async_engine(*_args, **_kwargs) -> _DummyEngine:
            return _DummyEngine()

        def async_sessionmaker(*_args, **_kwargs):
            def _factory():
                raise RuntimeError("SQLAlchemy is not installed in this environment")

            return _factory

        sa_mod.text = text
        sa_async_mod.AsyncSession = AsyncSession
        sa_async_mod.create_async_engine = create_async_engine
        sa_async_mod.async_sessionmaker = async_sessionmaker
        sa_ext_mod.asyncio = sa_async_mod
        sa_mod.ext = sa_ext_mod

        sys.modules["sqlalchemy"] = sa_mod
        sys.modules["sqlalchemy.ext"] = sa_ext_mod
        sys.modules["sqlalchemy.ext.asyncio"] = sa_async_mod

    if find_spec("httpx") is None and "httpx" not in sys.modules:
        httpx_mod = types.ModuleType("httpx")

        class HTTPError(Exception):
            pass

        class Limits:
            def __init__(self, *args, **kwargs) -> None:
                pass

        class AsyncClient:
            def __init__(self, *args, **kwargs) -> None:
                pass

            async def get(self, *args, **kwargs):
                raise RuntimeError("httpx is not installed in this environment")

            async def post(self, *args, **kwargs):
                raise RuntimeError("httpx is not installed in this environment")

            async def aclose(self) -> None:
                return None

        httpx_mod.HTTPError = HTTPError
        httpx_mod.Limits = Limits
        httpx_mod.AsyncClient = AsyncClient
        sys.modules["httpx"] = httpx_mod

    if find_spec("aio_pika") is None and "aio_pika" not in sys.modules:
        pika_mod = types.ModuleType("aio_pika")

        class ExchangeType:
            TOPIC = "topic"

        async def _connect_robust(*_args, **_kwargs):
            raise RuntimeError("aio_pika is not installed in this environment")

        pika_mod.ExchangeType = ExchangeType
        pika_mod.connect_robust = _connect_robust
        sys.modules["aio_pika"] = pika_mod

    if find_spec("redis") is None and "redis" not in sys.modules:
        redis_mod = types.ModuleType("redis")
        redis_async_mod = types.ModuleType("redis.asyncio")

        class _DummyRedis:
            async def get(self, *_args, **_kwargs):
                return None

            async def setex(self, *_args, **_kwargs):
                return None

            async def aclose(self) -> None:
                return None

        def from_url(*_args, **_kwargs):
            return _DummyRedis()

        redis_async_mod.from_url = from_url
        redis_mod.asyncio = redis_async_mod
        sys.modules["redis"] = redis_mod
        sys.modules["redis.asyncio"] = redis_async_mod


_install_missing_shims()


def _run_coroutine_sync(coro):
    try:
        while True:
            yielded = coro.send(None)
            if yielded is not None:
                raise RuntimeError(f"Unexpected OS awaitable in sandbox runner: {yielded!r}")
    except StopIteration as exc:
        return exc.value
    finally:
        coro.close()


def pytest_configure(config) -> None:
    if not config.pluginmanager.has_plugin("asyncio"):
        config.addinivalue_line("markers", "asyncio: fallback async test marker")


def pytest_pyfunc_call(pyfuncitem):
    if pyfuncitem.config.pluginmanager.has_plugin("asyncio"):
        return None
    if inspect.iscoroutinefunction(pyfuncitem.obj):
        sig = inspect.signature(pyfuncitem.obj)
        kwargs = {
            name: pyfuncitem.funcargs[name]
            for name in sig.parameters
            if name in pyfuncitem.funcargs
        }
        _run_coroutine_sync(pyfuncitem.obj(**kwargs))
        return True
    return None
