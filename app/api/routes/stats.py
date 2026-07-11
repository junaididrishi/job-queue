from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.repository import get_task_stats, list_workers
from app.queue.queue import get_queue_depths
from app.schemas.stats import StatsResponse, TaskStats, QueueDepths, WorkerStats, WorkerInfo
from app.api.deps import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    task_stats = await get_task_stats(db)
    depths = await get_queue_depths()
    workers = await list_workers(db)

    worker_list = [WorkerInfo.model_validate(w) for w in workers]
    return StatsResponse(
        tasks=TaskStats(**task_stats),
        queue=QueueDepths(**depths),
        workers=WorkerStats(
            total=len(workers),
            idle=sum(1 for w in workers if w.status == "idle"),
            busy=sum(1 for w in workers if w.status == "busy"),
            offline=sum(1 for w in workers if w.status == "offline"),
            list=worker_list,
        ),
    )
