import time
import random
from typing import Any


def handle_email(payload: dict) -> dict:
    to = payload.get("to") or payload.get("recipient")
    subject = payload.get("subject", "")
    if not to or not subject:
        raise ValueError("Missing required fields: to, subject")
    time.sleep(0.3 + random.random() * 0.4)
    if random.random() < 0.10:  # 10% failure rate to demo retries
        raise ConnectionError("SMTP connection timeout")
    return {
        "message_id": f"msg_{int(time.time() * 1000)}",
        "to": to,
        "subject": subject,
        "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "provider": "simulated-smtp",
    }


def handle_image_resize(payload: dict) -> dict:
    source_url = payload.get("source_url")
    width = payload.get("width")
    height = payload.get("height")
    if not all([source_url, width, height]):
        raise ValueError("Missing required fields: source_url, width, height")
    time.sleep(0.5 + random.random() * 1.0)
    fmt = payload.get("format", "webp")
    return {
        "output_url": f"https://cdn.example.com/resized/{int(time.time())}_{width}x{height}.{fmt}",
        "original_url": source_url,
        "dimensions": {"width": width, "height": height},
        "format": fmt,
        "size_bytes": random.randint(50_000, 500_000),
        "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def handle_report_generation(payload: dict) -> dict:
    report_type = payload.get("report_type")
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    if not all([report_type, start_date, end_date]):
        raise ValueError("Missing required fields: report_type, start_date, end_date")
    time.sleep(1.0 + random.random() * 2.0)
    return {
        "report_id": f"rpt_{int(time.time())}",
        "report_type": report_type,
        "period": {"start_date": start_date, "end_date": end_date},
        "download_url": f"https://reports.example.com/{report_type}_{int(time.time())}.pdf",
        "row_count": random.randint(100, 10_000),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def handle_data_export(payload: dict) -> dict:
    entity = payload.get("entity")
    fmt = payload.get("format", "csv")
    if not entity:
        raise ValueError("Missing required field: entity")
    time.sleep(0.8 + random.random() * 1.2)
    return {
        "export_id": f"exp_{int(time.time())}",
        "entity": entity,
        "format": fmt,
        "download_url": f"https://exports.example.com/{entity}_{int(time.time())}.{fmt}",
        "record_count": random.randint(1_000, 50_000),
        "file_size_bytes": random.randint(100_000, 10_000_000),
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def handle_notification(payload: dict) -> dict:
    channel = payload.get("channel", "push")
    recipient = payload.get("recipient")
    message = payload.get("message")
    if not all([recipient, message]):
        raise ValueError("Missing required fields: recipient, message")
    time.sleep(0.1 + random.random() * 0.2)
    return {
        "notification_id": f"ntf_{int(time.time())}",
        "channel": channel,
        "recipient": recipient,
        "delivered": True,
        "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


HANDLERS = {
    "email": handle_email,
    "image_resize": handle_image_resize,
    "report_generation": handle_report_generation,
    "data_export": handle_data_export,
    "notification": handle_notification,
}


def execute_job(task_type: str, payload: dict) -> dict:
    handler = HANDLERS.get(task_type)
    if not handler:
        raise ValueError(f"No handler registered for task type: {task_type}")
    return handler(payload)
