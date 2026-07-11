import json
from typing import Optional
from app.core.config import get_settings
from app.queue.client import get_async_redis, get_sync_redis

settings = get_settings()

PRIORITY_KEYS = {
    "high":   settings.QUEUE_HIGH,
    "normal": settings.QUEUE_NORMAL,
    "low":    settings.QUEUE_LOW,
}


def _queue_key(priority: str) -> str:
    return PRIORITY_KEYS.get(priority, settings.QUEUE_NORMAL)


# ── Async (used by API) ───────────────────────────────────────────────────────

async def enqueue(task_id: str, task_type: str, priority: str) -> None:
    r = get_async_redis()
    message = json.dumps({"task_id": task_id, "type": task_type, "priority": priority})
    await r.lpush(_queue_key(priority), message)


async def get_queue_depths() -> dict:
    r = get_async_redis()
    high, normal, low, dead = await r.llen(settings.QUEUE_HIGH), \
        await r.llen(settings.QUEUE_NORMAL), \
        await r.llen(settings.QUEUE_LOW), \
        await r.llen(settings.QUEUE_DEAD)
    return {"high": high, "normal": normal, "low": low, "dead": dead, "total": high + normal + low}


# ── Sync (used by worker threads) ────────────────────────────────────────────

def dequeue_sync(timeout: int) -> Optional[dict]:
    """BRPOP across priority queues — returns parsed message or None on timeout."""
    r = get_sync_redis()
    result = r.brpop(
        [settings.QUEUE_HIGH, settings.QUEUE_NORMAL, settings.QUEUE_LOW],
        timeout=timeout,
    )
    if not result:
        return None
    _, raw = result
    return json.loads(raw)


def enqueue_dead_letter_sync(task_id: str, reason: str) -> None:
    r = get_sync_redis()
    r.lpush(settings.QUEUE_DEAD, json.dumps({"task_id": task_id, "reason": reason}))


def enqueue_sync(task_id: str, task_type: str, priority: str) -> None:
    r = get_sync_redis()
    message = json.dumps({"task_id": task_id, "type": task_type, "priority": priority})
    r.lpush(_queue_key(priority), message)
