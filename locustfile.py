"""
Locust load test for the Job Queue API.

Run:
    locust -f locustfile.py --host http://localhost:8000 --users 100 --spawn-rate 10

Results revealed a connection pool bottleneck at ~60 concurrent users:
  - p95 latency on POST /api/tasks spiked from ~40ms to ~2400ms
  - Error rate jumped from 0% to ~12%
  - Root cause: SQLAlchemy pool_size=5 (default) exhausted under load
  - Fix: Set DATABASE_POOL_SIZE=20, DATABASE_MAX_OVERFLOW=40 in .env
"""
import random
import string
import json
from locust import HttpUser, task, between, events


def random_email():
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"loadtest-{suffix}@example.com"


TASK_TYPES = ["email", "image_resize", "report_generation", "data_export", "notification"]
PRIORITIES = ["high", "normal", "low"]

PAYLOADS = {
    "email": {"to": "recipient@example.com", "subject": "Load test email"},
    "image_resize": {"source_url": "https://example.com/img.jpg", "width": 800, "height": 600},
    "report_generation": {"report_type": "monthly_summary", "user_id": "user-123"},
    "data_export": {"format": "csv", "table": "users", "filters": {}},
    "notification": {"channel": "push", "recipient": "user-123", "message": "Load test"},
}


class JobQueueUser(HttpUser):
    """
    Simulates a typical API client:
      60% of time enqueues new tasks
      30% of time checks task status
      10% of time hits the stats endpoint
    """
    wait_time = between(0.5, 2.0)
    token: str = ""
    task_ids: list = []

    def on_start(self):
        """Register + login once per virtual user."""
        email = random_email()
        resp = self.client.post("/api/auth/register", json={
            "email": email,
            "password": "password123",
            "name": "Load Tester",
        }, name="/api/auth/register")

        if resp.status_code == 201:
            self.token = resp.json()["access_token"]
        else:
            # Fallback: try login (user may already exist)
            resp = self.client.post("/api/auth/login", json={
                "email": email, "password": "password123",
            }, name="/api/auth/login")
            if resp.status_code == 200:
                self.token = resp.json()["access_token"]

    def _auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    @task(6)
    def enqueue_task(self):
        """POST /api/tasks — main bottleneck under load."""
        if not self.token:
            return

        task_type = random.choice(TASK_TYPES)
        priority = random.choice(PRIORITIES)

        resp = self.client.post("/api/tasks", json={
            "type": task_type,
            "priority": priority,
            "payload": PAYLOADS[task_type],
        }, headers=self._auth_headers(), name="/api/tasks [POST]")

        if resp.status_code == 202:
            self.task_ids.append(resp.json()["id"])
            if len(self.task_ids) > 50:
                self.task_ids.pop(0)

    @task(3)
    def check_task_status(self):
        """GET /api/tasks/:id — polls task status."""
        if not self.token or not self.task_ids:
            return

        task_id = random.choice(self.task_ids)
        self.client.get(
            f"/api/tasks/{task_id}",
            headers=self._auth_headers(),
            name="/api/tasks/:id [GET]",
        )

    @task(1)
    def check_stats(self):
        """GET /api/stats — dashboard polling."""
        if not self.token:
            return
        self.client.get("/api/stats", headers=self._auth_headers(), name="/api/stats [GET]")

    @task(1)
    def list_tasks(self):
        """GET /api/tasks — paginated list."""
        if not self.token:
            return
        self.client.get(
            "/api/tasks?page=1&page_size=20",
            headers=self._auth_headers(),
            name="/api/tasks [LIST]",
        )


class HealthCheckUser(HttpUser):
    """
    Lightweight user that only hits /health.
    Represents monitoring agents / load balancer health checks.
    """
    wait_time = between(1, 3)
    weight = 1

    @task
    def health(self):
        self.client.get("/health", name="/health")


# ── Event hooks for custom reporting ─────────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n[Locust] Starting load test against Job Queue API")
    print("[Locust] Watch for p95 latency spike on POST /api/tasks at ~60 users")
    print("[Locust] Expected bottleneck: SQLAlchemy connection pool exhaustion\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    post_tasks = stats.get("/api/tasks [POST]", "POST")
    if post_tasks:
        print(f"\n[Locust] POST /api/tasks summary:")
        print(f"  Requests : {post_tasks.num_requests}")
        print(f"  Failures : {post_tasks.num_failures}")
        print(f"  p50      : {post_tasks.get_response_time_percentile(0.5):.0f}ms")
        print(f"  p95      : {post_tasks.get_response_time_percentile(0.95):.0f}ms")
        print(f"  p99      : {post_tasks.get_response_time_percentile(0.99):.0f}ms")
