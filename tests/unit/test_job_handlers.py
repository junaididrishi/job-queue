import pytest
from unittest.mock import patch
from app.worker.jobs.handlers import (
    handle_email, handle_image_resize, handle_notification,
    execute_job, HANDLERS,
)


@patch("app.worker.jobs.handlers.time.sleep")
@patch("app.worker.jobs.handlers.random.random", return_value=0.5)
def test_handle_email_success(mock_rand, mock_sleep):
    result = handle_email({"to": "user@example.com", "subject": "Hello"})
    assert result["to"] == "user@example.com"
    assert "message_id" in result
    assert result["provider"] == "simulated-smtp"


def test_handle_email_missing_fields():
    with pytest.raises(ValueError, match="Missing required fields"):
        handle_email({"to": "user@example.com"})  # no subject


@patch("app.worker.jobs.handlers.time.sleep")
@patch("app.worker.jobs.handlers.random.random", return_value=0.5)
def test_handle_image_resize_success(mock_rand, mock_sleep):
    result = handle_image_resize({
        "source_url": "https://example.com/img.jpg",
        "width": 800, "height": 600,
    })
    assert "output_url" in result
    assert result["dimensions"] == {"width": 800, "height": 600}


@patch("app.worker.jobs.handlers.time.sleep")
@patch("app.worker.jobs.handlers.random.random", return_value=0.5)
def test_handle_notification_success(mock_rand, mock_sleep):
    result = handle_notification({
        "channel": "push", "recipient": "user123", "message": "Hello!",
    })
    assert result["delivered"] is True
    assert result["channel"] == "push"


def test_execute_job_dispatches_correctly():
    with patch("app.worker.jobs.handlers.handle_notification") as mock_handler:
        mock_handler.return_value = {"delivered": True}
        result = execute_job("notification", {"recipient": "u", "message": "m"})
        mock_handler.assert_called_once()


def test_execute_job_unknown_type():
    with pytest.raises(ValueError, match="No handler registered"):
        execute_job("invalid_type", {})


def test_all_task_types_have_handlers():
    expected = {"email", "image_resize", "report_generation", "data_export", "notification"}
    assert set(HANDLERS.keys()) == expected
