import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.repository import create_task, get_task, list_tasks, get_task_logs
from app.queue.queue import enqueue
from app.schemas.task import (
    TaskCreate, TaskResponse, TaskDetailResponse,
    TaskListResponse, TaskLogResponse, TaskStatus,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_task_endpoint(
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    task_id = str(uuid.uuid4())
    task = await create_task(
        db,
        id=task_id,
        type=body.type.value,
        priority=body.priority.value,
        payload=body.payload,
        max_retries=body.max_retries,
        webhook_url=body.webhook_url,
    )
    await enqueue(task_id, body.type.value, body.priority.value)
    return task


@router.get("", response_model=TaskListResponse)
async def list_tasks_endpoint(
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    tasks, total = await list_tasks(db, status=status, task_type=type, limit=limit, offset=offset)
    return TaskListResponse(
        tasks=tasks, total=total, limit=limit, offset=offset,
        has_more=offset + limit < total,
    )


@router.get("/{task_id}", response_model=TaskDetailResponse)
async def get_task_endpoint(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    task = await get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    logs = await get_task_logs(db, task_id)
    log_responses = [
        TaskLogResponse(
            id=log.id, task_id=log.task_id, worker_id=log.worker_id,
            event=log.event, message=log.message,
            metadata_=log.metadata_, created_at=log.created_at,
        )
        for log in logs
    ]
    return TaskDetailResponse(
        **{c.key: getattr(task, c.key) for c in task.__table__.columns},
        logs=log_responses,
    )
