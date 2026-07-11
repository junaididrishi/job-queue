from pydantic import BaseModel
from typing import List
from datetime import datetime


class TaskStats(BaseModel):
    total: int
    pending: int
    processing: int
    completed: int
    failed: int
    dead: int
    avg_processing_ms: int
    success_rate: int


class QueueDepths(BaseModel):
    high: int
    normal: int
    low: int
    dead: int
    total: int


class WorkerInfo(BaseModel):
    id: str
    hostname: str
    pid: int
    status: str
    current_task_id: str | None
    tasks_processed: int
    tasks_failed: int
    last_heartbeat: datetime

    model_config = {"from_attributes": True}


class WorkerStats(BaseModel):
    total: int
    idle: int
    busy: int
    offline: int
    list: List[WorkerInfo]


class StatsResponse(BaseModel):
    tasks: TaskStats
    queue: QueueDepths
    workers: WorkerStats
