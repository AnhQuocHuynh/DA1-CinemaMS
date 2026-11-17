from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    POSTGRES_URL: str = "postgresql+asyncpg://postgres:123@localhost:5432/ai_chatbot_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    RABBITMQ_URL: str = "amqp://cinema:guest@localhost:5672/"

    AI_PROVIDER: str = "Gemini"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-004"

    CATALOG_SERVICE_URL: str = "http://localhost:8081"
    SHOWTIME_SERVICE_URL: str = "http://localhost:8082"
    FACILITY_SERVICE_URL: str = "http://localhost:80"
    RECOMMENDATION_SERVICE_URL: str = "http://localhost:8085"
    INTERNAL_API_TOKEN: str = "local-dev-internal-token"

    MAX_MESSAGE_LENGTH: int = 500
    HISTORY_WINDOW_TURNS: int = 4
    EXACT_CACHE_TTL_SECONDS: int = 24 * 3600
    SEMANTIC_CACHE_TTL_DAYS: int = 7
    SEMANTIC_CACHE_THRESHOLD: float = 0.94
    FAQ_SIMILARITY_THRESHOLD: float = 0.80
    FAQ_RELATIVE_MARGIN: float = 0.08
    MOVIE_RELATIVE_MARGIN: float = 0.08
    REINDEX_ON_STARTUP: bool = True
    REINDEX_MAX_MOVIES: int = 500


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

