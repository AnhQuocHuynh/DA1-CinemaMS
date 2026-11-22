from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    POSTGRES_URL: str = "postgresql+asyncpg://postgres:123@localhost:5432/ai_chatbot_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    RABBITMQ_URL: str = "amqp://cinema:guest@localhost:5672/"

    AI_PROVIDER: str = "Gemini"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    EMBEDDING_MODEL: str = "gemini-embedding-001"

    CATALOG_SERVICE_URL: str = "http://localhost:8081"
    SHOWTIME_SERVICE_URL: str = "http://localhost:8082"
    BOOKING_SERVICE_URL: str = "http://localhost:8083"
    FACILITY_SERVICE_URL: str = "http://localhost:80"
    RECOMMENDATION_SERVICE_URL: str = "http://localhost:8085"
    IDENTITY_SERVICE_URL: str = "http://localhost:5001"
    INTERNAL_API_TOKEN: str = "local-dev-internal-token"
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ALLOWED_ORIGINS: str = ""

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        raw = self.CORS_ALLOWED_ORIGINS.strip()
        if raw:
            origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
            if origins:
                return origins
        frontend = self.FRONTEND_URL.strip().rstrip("/")
        if frontend:
            return [frontend]
        return ["http://localhost:5173"]

    CINEMA_SECURITY_JWT_ENABLED: bool = False
    KEYCLOAK_ISSUER_URI: str = ""
    KEYCLOAK_AUDIENCE: str = "cinema-api"
    KEYCLOAK_JWK_SET_URI: str = ""
    DEV_ACTOR_ID: int | None = None

    @field_validator("DEV_ACTOR_ID", mode="before")
    @classmethod
    def _empty_str_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    MAX_MESSAGE_LENGTH: int = 500
    HISTORY_WINDOW_TURNS: int = 4
    EXACT_CACHE_TTL_SECONDS: int = 24 * 3600
    SEMANTIC_CACHE_TTL_DAYS: int = 7
    SEMANTIC_CACHE_THRESHOLD: float = 0.94
    FAQ_SIMILARITY_THRESHOLD: float = 0.55
    FAQ_RELATIVE_MARGIN: float = 0.08
    MOVIE_RELATIVE_MARGIN: float = 0.08
    REINDEX_ON_STARTUP: bool = True
    REINDEX_MAX_MOVIES: int = 500

    DOWNSTREAM_TIMEOUT_SECONDS: float = 3.0
    DOWNSTREAM_MAX_RETRIES: int = 2
    DOWNSTREAM_RETRY_BASE_DELAY: float = 0.15
    DOWNSTREAM_RETRY_MAX_DELAY: float = 1.5
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = 5
    CIRCUIT_BREAKER_RECOVERY_SECONDS: float = 30.0
    LLM_MAX_RETRIES: int = 1
    LLM_RETRY_BASE_DELAY: float = 0.25


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

