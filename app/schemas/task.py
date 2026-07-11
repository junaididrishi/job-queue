from datetime import datetime
from typing import Any, Optional, List
from pydantic import BaseModel, HttpUrl, field_validator
from enum import Enum


class TaskType(str, Enum):
    email = "email"
    image_resize = "image_resize"
    report_generation = "report_generation"
    data_export = "data_export"
    notification = "notification"


class TaskStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    dead = "dead"


class TaskPriority(str, Enum):
    high = "high"
    normal = "normal"
    low = "low"


class TaskCreate(BaseModel):
    type: TaskType
    priority: TaskPriority = TaskPriority.normal
    payload: dict[str, Any]
    webhook_url: Optional[str] = None
    max_retries: int = 3

    @field_validator("max_retries")
    @classmethod
    def validate_retries(cls, v: int) -> int:
        if not 0 <= v <= 10:
            raise ValueError("max_retries must be between 0 and 10")
        return v


class TaskResponse(BaseModel):
    id: str
    type: str
    status: str
    priority: str
    payload: dict[str, Any]
    result: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    retry_count: int
    max_retries: int
    next_retry_at: Optional[datetime] = None
    worker_id: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_delivered: bool
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TaskLogResponse(BaseModel):
    id: str
    task_id: str
    worker_id: Optional[str] = None
    event: str
    message: str
    metadata_: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskDetailResponse(TaskResponse):
    logs: List[TaskLogResponse] = []


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
