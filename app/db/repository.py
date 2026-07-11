from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, update, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.models.task import Task, TaskLog
from app.models.worker import Worker


# ── Task operations ───────────────────────────────────────────────────────────

async def create_task(db: AsyncSession, **kwargs) -> Task:
    task = Task(**kwargs)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def get_task(db: AsyncSession, task_id: str) -> Optional[Task]:
    result = await db.execute(select(Task).where(Task.id == task_id))
    return result.scalar_one_or_none()


async def list_tasks(
    db: AsyncSession,
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Task], int]:
    q = select(Task)
    count_q = select(func.count()).select_from(Task)
    if status:
        q = q.where(Task.status == status)
        count_q = count_q.where(Task.status == status)
    if task_type:
        q = q.where(Task.type == task_type)
        count_q = count_q.where(Task.type == task_type)
    q = q.order_by(Task.created_at.desc()).limit(limit).offset(offset)
    tasks = (await db.execute(q)).scalars().all()
    total = (await db.execute(count_q)).scalar_one()
    return list(tasks), total


async def update_task(db: AsyncSession, task_id: str, **fields) -> Optional[Task]:
    fields["updated_at"] = datetime.now(timezone.utc)
    await db.execute(update(Task).where(Task.id == task_id).values(**fields))
    await db.commit()
    return await get_task(db, task_id)


async def get_task_stats(db: AsyncSession) -> dict:
    result = await db.execute(text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending')    AS pending,
            COUNT(*) FILTER (WHERE status = 'processing') AS processing,
            COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
            COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
            COUNT(*) FILTER (WHERE status = 'dead')       AS dead,
            COALESCE(
                AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)
                FILTER (WHERE status = 'completed'
                    AND started_at IS NOT NULL AND completed_at IS NOT NULL), 0
            )::BIGINT AS avg_processing_ms
        FROM tasks
    """))
    row = result.mappings().one()
    done = int(row["completed"]) + int(row["failed"])
    return {
        "total": int(row["total"]),
        "pending": int(row["pending"]),
        "processing": int(row["processing"]),
        "completed": int(row["completed"]),
        "failed": int(row["failed"]),
        "dead": int(row["dead"]),
        "avg_processing_ms": int(row["avg_processing_ms"]),
        "success_rate": round(int(row["completed"]) / done * 100) if done else 0,
    }


async def add_task_log(db: AsyncSession, task_id: str, event: str, message: str,
                       worker_id: Optional[str] = None, metadata: Optional[dict] = None):
    log = TaskLog(task_id=task_id, worker_id=worker_id, event=event,
                  message=message, metadata_=metadata)
    db.add(log)
    await db.commit()


async def get_task_logs(db: AsyncSession, task_id: str) -> list[TaskLog]:
    result = await db.execute(
        select(TaskLog).where(TaskLog.task_id == task_id).order_by(TaskLog.created_at)
    )
    return list(result.scalars().all())


async def mark_webhook_delivered(db: AsyncSession, task_id: str):
    await db.execute(update(Task).where(Task.id == task_id).values(webhook_delivered=True))
    await db.commit()


# ── Sync task ops (used by worker threads) ────────────────────────────────────

def get_task_sync(db: Session, task_id: str) -> Optional[Task]:
    return db.get(Task, task_id)


def update_task_sync(db: Session, task_id: str, **fields) -> Optional[Task]:
    fields["updated_at"] = datetime.now(timezone.utc)
    db.execute(update(Task).where(Task.id == task_id).values(**fields))
    db.commit()
    return db.get(Task, task_id)


def add_task_log_sync(db: Session, task_id: str, event: str, message: str,
                      worker_id: Optional[str] = None, metadata: Optional[dict] = None):
    log = TaskLog(task_id=task_id, worker_id=worker_id, event=event,
                  message=message, metadata_=metadata)
    db.add(log)
    db.commit()


def mark_webhook_delivered_sync(db: Session, task_id: str):
    db.execute(update(Task).where(Task.id == task_id).values(webhook_delivered=True))
    db.commit()


# ── Worker operations ─────────────────────────────────────────────────────────

def register_worker_sync(db: Session, worker_id: str, hostname: str, pid: int) -> Worker:
    existing = db.get(Worker, worker_id)
    if existing:
        existing.hostname = hostname
        existing.pid = pid
        existing.status = "idle"
        existing.last_heartbeat = datetime.now(timezone.utc)
        db.commit()
        return existing
    w = Worker(id=worker_id, hostname=hostname, pid=pid)
    db.add(w)
    db.commit()
    return w


def heartbeat_sync(db: Session, worker_id: str):
    db.execute(
        update(Worker).where(Worker.id == worker_id)
        .values(last_heartbeat=datetime.now(timezone.utc))
    )
    db.commit()


def set_worker_status_sync(db: Session, worker_id: str, status: str,
                           current_task_id: Optional[str] = None):
    db.execute(
        update(Worker).where(Worker.id == worker_id)
        .values(status=status, current_task_id=current_task_id,
                last_heartbeat=datetime.now(timezone.utc))
    )
    db.commit()


def increment_worker_stats_sync(db: Session, worker_id: str, success: bool):
    col = Worker.tasks_processed if success else Worker.tasks_failed
    db.execute(update(Worker).where(Worker.id == worker_id).values({col: col + 1}))
    db.commit()


def mark_worker_offline_sync(db: Session, worker_id: str):
    db.execute(
        update(Worker).where(Worker.id == worker_id)
        .values(status="offline", current_task_id=None)
    )
    db.commit()


async def list_workers(db: AsyncSession) -> list[Worker]:
    result = await db.execute(select(Worker).order_by(Worker.created_at.desc()))
    return list(result.scalars().all())
