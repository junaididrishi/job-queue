import json
import redis.asyncio as aioredis
import redis as sync_redis
from app.core.config import get_settings

settings = get_settings()

_async_pool: aioredis.Redis | None = None
_sync_pool: sync_redis.Redis | None = None


def get_async_redis() -> aioredis.Redis:
    global _async_pool
    if _async_pool is None:
        _async_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _async_pool


def get_sync_redis() -> sync_redis.Redis:
    global _sync_pool
    if _sync_pool is None:
        _sync_pool = sync_redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _sync_pool


async def close_redis():
    global _async_pool
    if _async_pool:
        await _async_pool.aclose()
        _async_pool = None
