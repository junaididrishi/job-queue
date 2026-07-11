"""
Integration tests for the FastAPI application.
Requires a running PostgreSQL and Redis instance (provided by docker-compose in CI).

Run locally:
    pytest tests/integration/ -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from unittest.mock import patch, AsyncMock

from app.main import app
from app.db.base import get_db, Base


TEST_DB_URL = "postgresql+asyncpg://postgres:password@localhost:5432/job_queue_test"


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_and_login(client):
    import uuid
    email = f"test-{uuid.uuid4()}@example.com"

    # Register
    r = await client.post("/api/auth/register", json={
        "email": email, "password": "password123", "name": "Test User",
    })
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert data["email"] == email

    # Login with same creds
    r2 = await client.post("/api/auth/login", json={"email": email, "password": "password123"})
    assert r2.status_code == 200
    assert "access_token" in r2.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    r = await client.post("/api/auth/login", json={
        "email": "nobody@example.com", "password": "wrong",
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_create_task_requires_auth(client):
    r = await client.post("/api/tasks", json={
        "type": "email", "payload": {"to": "a@b.com", "subject": "Hi"},
    })
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_create_and_get_task(client):
    import uuid
    email = f"task-test-{uuid.uuid4()}@example.com"

    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "password123", "name": "Tester",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.api.routes.tasks.enqueue", new_callable=AsyncMock):
        r = await client.post("/api/tasks", json={
            "type": "email",
            "priority": "high",
            "payload": {"to": "user@example.com", "subject": "Welcome"},
        }, headers=headers)

    assert r.status_code == 202
    task_id = r.json()["id"]
    assert r.json()["status"] == "pending"
    assert r.json()["priority"] == "high"

    # Fetch by ID
    r2 = await client.get(f"/api/tasks/{task_id}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["id"] == task_id


@pytest.mark.asyncio
async def test_get_task_not_found(client):
    import uuid
    email = f"notfound-{uuid.uuid4()}@example.com"
    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "password123", "name": "X",
    })
    token = reg.json()["access_token"]
    r = await client.get("/api/tasks/nonexistent-id",
                         headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_invalid_task_type(client):
    import uuid
    email = f"invalid-{uuid.uuid4()}@example.com"
    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "password123", "name": "X",
    })
    token = reg.json()["access_token"]
    r = await client.post("/api/tasks", json={
        "type": "invalid_type", "payload": {},
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422
