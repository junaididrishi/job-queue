"""
Multi-threaded worker service.

Architecture:
  - Main thread:  spawns N worker threads via ThreadPoolExecutor, handles graceful shutdown.
  - Worker thread: calls dequeue_sync (BRPOP — blocks until a job arrives), executes the job,
                   updates Postgres, handles retry / dead-letter logic.
  - Heartbeat thread: updates worker.last_heartbeat in Postgres every 10s.

Concurrency: WORKER_CONCURRENCY threads each hold their own blocking BRPOP connection,
so the system processes N tasks simultaneously without asyncio complexity.
"""

import os
import socket
import signal
import time
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from typing import Optional

import sentry_sdk
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import get_settings
from app.core.logging import configure_logging, logger
from app.queue.queue import dequeue_sync, enqueue_sync, enqueue_dead_letter_sync
from app.db.repository import (
    get_task_sync, update_task_sync, add_task_log_sync,
    register_worker_sync, heartbeat_sync, set_worker_status_sync,
    increment_worker_stats_sync, mark_worker_offline_sync,
    mark_webhook_delivered_sync,
)
from app.worker.jobs.handlers import execute_job
from app.worker.webhook import deliver_webhook

settings = get_settings()
configure_logging()

if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1, environment=settings.APP_ENV)

WORKER_ID = str(uuid.uuid4())
HOSTNAME = socket.gethostname()
_shutdown = threading.Event()

# Sync SQLAlchemy engine — one connection pool shared across all worker threads
engine = create_engine(
    settings.DATABASE_URL_SYNC,
    pool_size=settings.WORKER_CONCURRENCY + 5,
    max_overflow=5,
    pool_pre_ping=True,
)
SessionFactory = sessionmaker(bind=engine)


def retry_delay_ms(attempt: int) -> int:
    """Exponential backoff: 5s * 2^attempt, capped at 1 hour."""
    return min(5_000 * (2 ** attempt), 3_600_000)


def process_one(thread_id: int) -> None:
    """Pull one task from Redis, execute it, update Postgres. Called in a loop by each thread."""
    message = dequeue_sync(settings.WORKER_POLL_TIMEOUT)
    if not message:
        return  # BRPOP timed out — no work available

    task_id = message["task_id"]
    db: Session = SessionFactory()
    try:
        task = get_task_sync(db, task_id)
        if not task:
            logger.warning("task_not_found", task_id=task_id)
            return
        if task.status not in ("pending", "failed"):
            logger.warning("task_skip", task_id=task_id, status=task.status)
            return

        started_at = datetime.now(timezone.utc)
        logger.info("task_start", task_id=task_id, type=task.type,
                    priority=task.priority, attempt=task.retry_count + 1, thread=thread_id)

        set_worker_status_sync(db, WORKER_ID, "busy", task_id)
        update_task_sync(db, task_id, status="processing", worker_id=WORKER_ID, started_at=started_at)
        add_task_log_sync(db, task_id, "processing_started",
                          f"Worker {WORKER_ID} ({HOSTNAME}) thread-{thread_id} started",
                          worker_id=WORKER_ID)

        try:
            result = execute_job(task.type, task.payload)
            completed_at = datetime.now(timezone.utc)
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)

            update_task_sync(db, task_id, status="completed", result=result,
                             completed_at=completed_at, error_message=None)
            increment_worker_stats_sync(db, WORKER_ID, success=True)
            add_task_log_sync(db, task_id, "completed",
                              f"Completed in {duration_ms}ms",
                              worker_id=WORKER_ID, metadata={"duration_ms": duration_ms})
            logger.info("task_done", task_id=task_id, duration_ms=duration_ms)

            # Webhook delivery
            if task.webhook_url and not task.webhook_delivered:
                ok = deliver_webhook(
                    task_id=task_id, task_type=task.type, status="completed",
                    result=result, error_message=None,
                    completed_at=completed_at.isoformat(), webhook_url=task.webhook_url,
                )
                if ok:
                    mark_webhook_delivered_sync(db, task_id)
                    add_task_log_sync(db, task_id, "webhook_delivered",
                                      f"Webhook delivered to {task.webhook_url}", worker_id=WORKER_ID)
                else:
                    add_task_log_sync(db, task_id, "webhook_failed",
                                      f"Webhook failed for {task.webhook_url}", worker_id=WORKER_ID)

        except Exception as exc:
            error_msg = str(exc)
            new_retry_count = task.retry_count + 1

            if settings.SENTRY_DSN:
                sentry_sdk.capture_exception(exc)

            logger.warning("task_failed", task_id=task_id, attempt=new_retry_count,
                           max=task.max_retries, error=error_msg)
            increment_worker_stats_sync(db, WORKER_ID, success=False)

            if new_retry_count >= task.max_retries:
                # Permanently failed — dead letter
                update_task_sync(db, task_id, status="dead",
                                 error_message=error_msg, retry_count=new_retry_count)
                enqueue_dead_letter_sync(task_id, error_msg)
                add_task_log_sync(db, task_id, "dead_lettered",
                                  f"Permanently failed after {new_retry_count} attempts: {error_msg}",
                                  worker_id=WORKER_ID, metadata={"attempts": new_retry_count})
                logger.error("task_dead", task_id=task_id, attempts=new_retry_count)

                if task.webhook_url:
                    deliver_webhook(
                        task_id=task_id, task_type=task.type, status="dead",
                        result=None, error_message=error_msg,
                        completed_at=datetime.now(timezone.utc).isoformat(),
                        webhook_url=task.webhook_url,
                    )
            else:
                delay_ms = retry_delay_ms(new_retry_count)
                next_retry_at = datetime.now(timezone.utc) + timedelta(milliseconds=delay_ms)
                update_task_sync(db, task_id, status="failed",
                                 error_message=error_msg, retry_count=new_retry_count,
                                 next_retry_at=next_retry_at)
                add_task_log_sync(db, task_id, "failed",
                                  f"Attempt {new_retry_count} failed. Retry in {delay_ms // 1000}s",
                                  worker_id=WORKER_ID,
                                  metadata={"error": error_msg, "retry_in_ms": delay_ms})

                # Re-enqueue after exponential backoff delay
                def _requeue(tid=task_id, ttype=task.type, pri=task.priority,
                             rc=new_retry_count, d=delay_ms):
                    time.sleep(d / 1000)
                    with SessionFactory() as s:
                        update_task_sync(s, tid, status="pending", retry_count=rc)
                    enqueue_sync(tid, ttype, pri)
                    logger.info("task_requeued", task_id=tid, attempt=rc + 1)

                threading.Thread(target=_requeue, daemon=True).start()

    finally:
        set_worker_status_sync(db, WORKER_ID, "idle", None)
        db.close()


def worker_thread(thread_id: int) -> None:
    """Each thread runs this loop independently."""
    logger.info("thread_start", thread_id=thread_id, worker_id=WORKER_ID)
    while not _shutdown.is_set():
        try:
            process_one(thread_id)
        except Exception as exc:
            logger.error("thread_error", thread_id=thread_id, error=str(exc))
            time.sleep(1)
    logger.info("thread_stop", thread_id=thread_id)


def heartbeat_loop(db: Session) -> None:
    while not _shutdown.is_set():
        try:
            heartbeat_sync(db, WORKER_ID)
        except Exception:
            pass
        time.sleep(settings.WORKER_HEARTBEAT_INTERVAL)


def main():
    logger.info("worker_start", worker_id=WORKER_ID, hostname=HOSTNAME,
                pid=os.getpid(), concurrency=settings.WORKER_CONCURRENCY)

    db: Session = SessionFactory()
    register_worker_sync(db, WORKER_ID, HOSTNAME, os.getpid())

    def shutdown(signum, _frame):
        logger.info("shutdown_signal", signal=signum)
        _shutdown.set()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    # Heartbeat in background daemon thread
    hb = threading.Thread(target=heartbeat_loop, args=(db,), daemon=True)
    hb.start()

    with ThreadPoolExecutor(max_workers=settings.WORKER_CONCURRENCY) as pool:
        futures = [pool.submit(worker_thread, i) for i in range(settings.WORKER_CONCURRENCY)]
        # Wait for shutdown signal then let threads drain
        _shutdown.wait()
        logger.info("draining_threads")
        for f in futures:
            f.cancel()

    mark_worker_offline_sync(db, WORKER_ID)
    db.close()
    logger.info("worker_stopped", worker_id=WORKER_ID)


if __name__ == "__main__":
    main()
