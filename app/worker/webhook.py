import hmac
import hashlib
import json
import urllib.request
import urllib.error
from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()


def deliver_webhook(task_id: str, task_type: str, status: str,
                    result: dict | None, error_message: str | None,
                    completed_at: str | None, webhook_url: str) -> bool:
    payload = {
        "task_id": task_id,
        "type": task_type,
        "status": status,
        "result": result,
        "error_message": error_message,
        "completed_at": completed_at,
    }
    body = json.dumps(payload).encode()
    signature = hmac.new(
        settings.WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()

    req = urllib.request.Request(
        webhook_url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-JobQueue-Signature": f"sha256={signature}",
            "X-JobQueue-TaskId": task_id,
            "X-JobQueue-Event": "task.completed",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.WEBHOOK_TIMEOUT):
            logger.info("webhook_delivered", task_id=task_id, url=webhook_url)
            return True
    except (urllib.error.URLError, Exception) as exc:
        logger.warning("webhook_failed", task_id=task_id, url=webhook_url, error=str(exc))
        return False
