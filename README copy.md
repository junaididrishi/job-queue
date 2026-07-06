# Job Queue / Task Processing System

A production-grade distributed job queue built with Node.js, TypeScript, PostgreSQL, and Redis.

## Architecture

```
                ┌──────────────┐      LPUSH       ┌─────────────────────┐
  Client ──▶   │  API Server  │ ──────────────▶  │  Redis Queues        │
               │  (Express)   │                   │  tasks:high          │
               └──────┬───────┘                   │  tasks:normal        │
                      │                           │  tasks:low           │
                      │ writes                    │  tasks:dead          │
                      ▼                           └──────────┬──────────┘
               ┌──────────────┐                              │ BRPOP
               │  PostgreSQL  │◀──── updates ───────────────┤
               │  tasks       │                   ┌──────────▼──────────┐
               │  workers     │                   │  Worker Process      │
               │  task_logs   │                   │  (separate process)  │
               └──────────────┘                   │  - retry + backoff   │
                                                  │  - dead letter queue │
                                                  │  - webhook delivery  │
                                                  └─────────────────────┘
```

## Features

- **5 task types**: email, image_resize, report_generation, data_export, notification
- **3 priority levels**: high → normal → low (strict BRPOP ordering)
- **Retry with exponential backoff**: 5s → 10s → 20s (max 3 retries by default)
- **Dead letter queue**: permanently failed tasks moved to `tasks:dead` Redis list
- **Webhook callbacks**: HMAC-signed POST to your URL on task completion/failure
- **JWT authentication** on all API endpoints
- **Live dashboard**: auto-refreshes every 3s, shows queue depth, success rate, avg time
- **Full audit log**: every state transition stored in `task_logs`
- **Graceful shutdown**: worker drains active jobs before exiting (30s timeout)

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — set DATABASE_URL and REDIS_URL

# 3. Create DB + schema + seed user
createdb job_queue
npm run db:setup
npm run db:seed        # creates admin@jobqueue.dev / password123

# 4. Build
npm run build

# 5. Start (two separate processes)
npm run start:api      # terminal 1 — API on :4000
npm run start:worker   # terminal 2 — background worker
```

Dashboard: http://localhost:4000/dashboard

## API

All endpoints (except /health, /dashboard, auth) require `Authorization: Bearer <token>`.

### Auth
```
POST /api/auth/register   { email, password, name }
POST /api/auth/login      { email, password }
```

### Tasks
```
POST   /api/tasks         Create and enqueue a task
GET    /api/tasks         List tasks (filter: ?status=&type=&limit=&offset=)
GET    /api/tasks/:id     Get task + full audit log
```

**POST /api/tasks body:**
```json
{
  "type": "email",
  "priority": "high",
  "payload": { "to": "user@example.com", "subject": "Hi", "body": "..." },
  "webhook_url": "https://your-server.com/webhook",
  "max_retries": 3
}
```

Task types and required payload fields:

| Type | Required payload |
|------|-----------------|
| `email` | `to`, `subject`, `body` |
| `image_resize` | `source_url`, `width`, `height` |
| `report_generation` | `report_type`, `start_date`, `end_date` |
| `data_export` | `entity`, `format` (`csv`\|`json`\|`xlsx`) |
| `notification` | `channel`, `recipient`, `message` |

### Stats
```
GET /api/stats   Queue depth, task counts, worker status
```

## Webhook

When a task completes or is dead-lettered, the system POSTs to `webhook_url`:

```json
{
  "task_id": "...",
  "type": "email",
  "status": "completed",
  "result": { ... },
  "error_message": null,
  "completed_at": "2026-07-05T20:00:00Z"
}
```

Verify with the `X-JobQueue-Signature: sha256=<hmac>` header using `WEBHOOK_SECRET`.

## Retry Logic

```
attempt 1 fails → wait 5s  → retry
attempt 2 fails → wait 10s → retry
attempt 3 fails → wait 20s → retry
attempt 4 fails → DEAD (moved to tasks:dead Redis list + status='dead')
```

## Deploy on Railway

Deploy as **two separate services** from the same repo:

**Service 1 — API:**
- Start command: `npm run build && node dist/api/server.js`
- Config file: `railway.toml`

**Service 2 — Worker:**
- Start command: `npm run build && node dist/worker/worker.js`
- Config file: `railway.worker.toml`

Add a Railway PostgreSQL and Redis plugin, then set env vars:
```
DATABASE_URL   (auto-set by Railway PostgreSQL plugin)
REDIS_URL      (auto-set by Railway Redis plugin)
JWT_SECRET     (generate a strong random string)
WEBHOOK_SECRET (generate a strong random string)
PORT           4000
```

Scale the worker horizontally by increasing its replica count — each worker process independently polls the priority queues.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | 4000 |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `JWT_SECRET` | JWT signing key | — |
| `JWT_EXPIRES_IN` | Token expiry | 7d |
| `WORKER_POLL_TIMEOUT` | BRPOP timeout (seconds) | 5 |
| `MAX_RETRIES` | Default max retries | 3 |
| `WEBHOOK_SECRET` | HMAC key for webhook signing | — |

## Why Redis LPUSH/BRPOP?

- **LPUSH** (push to left) + **BRPOP** (blocking pop from right) = **FIFO queue** with zero polling overhead
- `BRPOP` blocks the connection until a job arrives (or timeout) — no sleep loops, no wasted cycles
- Passing **multiple keys** to BRPOP with strict ordering (`high`, `normal`, `low`) gives **priority without polling** — Redis checks high first, atomically
- If the worker crashes mid-job, the task is already marked `processing` in Postgres — a recovery job (or manual re-enqueue) can pick it up
