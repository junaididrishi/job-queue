from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: str = "development"
    PORT: int = 8000

    # Store the raw database URL from environment or use default
    DATABASE_URL_RAW: str = "postgresql+asyncpg://postgres:password@localhost:5432/job_queue"
    DATABASE_URL_SYNC: str = "postgresql://postgres:password@localhost:5432/job_queue"

    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "dev-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    WORKER_CONCURRENCY: int = 5
    WORKER_POLL_TIMEOUT: int = 5
    MAX_RETRIES: int = 3

    WEBHOOK_SECRET: str = "dev-webhook-secret"
    WEBHOOK_TIMEOUT: int = 10

    SENTRY_DSN: str = ""

    # Redis queue key names
    QUEUE_HIGH: str = "tasks:high"
    QUEUE_NORMAL: str = "tasks:normal"
    QUEUE_LOW: str = "tasks:low"
    QUEUE_DEAD: str = "tasks:dead"

    WORKER_HEARTBEAT_INTERVAL: int = 10

    @property
    def DATABASE_URL(self) -> str:
        """Ensure the database URL always uses asyncpg driver."""
        url = self.DATABASE_URL_RAW
        # If the URL starts with postgresql:// (not postgresql+asyncpg://), fix it
        if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()