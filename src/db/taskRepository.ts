import pool from './pool';
import { Task, TaskStatus, TaskLog } from '../types';

export async function createTask(params: {
  id: string;
  type: string;
  priority: string;
  payload: Record<string, unknown>;
  max_retries: number;
  webhook_url?: string;
}): Promise<Task> {
  const { rows } = await pool.query<Task>(
    `INSERT INTO tasks (id, type, priority, payload, max_retries, webhook_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [params.id, params.type, params.priority, JSON.stringify(params.payload), params.max_retries, params.webhook_url ?? null]
  );
  return rows[0];
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { rows } = await pool.query<Task>('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listTasks(filters: {
  status?: TaskStatus;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: Task[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (filters.status) { conditions.push(`status = $${i++}`); values.push(filters.status); }
  if (filters.type) { conditions.push(`type = $${i++}`); values.push(filters.type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;

  const [dataResult, countResult] = await Promise.all([
    pool.query<Task>(
      `SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    ),
    pool.query<{ count: string }>(`SELECT COUNT(*) FROM tasks ${where}`, values),
  ]);

  return { tasks: dataResult.rows, total: parseInt(countResult.rows[0].count) };
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  extra: Partial<Pick<Task, 'worker_id' | 'result' | 'error_message' | 'started_at' | 'completed_at' | 'retry_count' | 'next_retry_at'>> = {}
): Promise<Task | null> {
  const setClauses = ['status = $2'];
  const values: unknown[] = [id, status];
  let idx = 3;

  if (extra.worker_id !== undefined) { setClauses.push(`worker_id = $${idx++}`); values.push(extra.worker_id); }
  if (extra.result !== undefined) { setClauses.push(`result = $${idx++}`); values.push(JSON.stringify(extra.result)); }
  if (extra.error_message !== undefined) { setClauses.push(`error_message = $${idx++}`); values.push(extra.error_message); }
  if (extra.started_at !== undefined) { setClauses.push(`started_at = $${idx++}`); values.push(extra.started_at); }
  if (extra.completed_at !== undefined) { setClauses.push(`completed_at = $${idx++}`); values.push(extra.completed_at); }
  if (extra.retry_count !== undefined) { setClauses.push(`retry_count = $${idx++}`); values.push(extra.retry_count); }
  if (extra.next_retry_at !== undefined) { setClauses.push(`next_retry_at = $${idx++}`); values.push(extra.next_retry_at); }

  const { rows } = await pool.query<Task>(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function markWebhookDelivered(id: string): Promise<void> {
  await pool.query('UPDATE tasks SET webhook_delivered = TRUE WHERE id = $1', [id]);
}

export async function addTaskLog(params: {
  task_id: string;
  worker_id?: string;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO task_logs (task_id, worker_id, event, message, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.task_id, params.worker_id ?? null, params.event, params.message, params.metadata ? JSON.stringify(params.metadata) : null]
  );
}

export async function getTaskLogs(task_id: string): Promise<TaskLog[]> {
  const { rows } = await pool.query<TaskLog>(
    'SELECT * FROM task_logs WHERE task_id = $1 ORDER BY created_at ASC',
    [task_id]
  );
  return rows;
}

export async function getStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
  avg_processing_ms: number;
  success_rate: number;
}> {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'processing') AS processing,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE status = 'dead') AS dead,
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)
          FILTER (WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL),
        0
      )::BIGINT AS avg_processing_ms
    FROM tasks
  `);
  const r = rows[0];
  const done = parseInt(r.completed) + parseInt(r.failed);
  return {
    total: parseInt(r.total),
    pending: parseInt(r.pending),
    processing: parseInt(r.processing),
    completed: parseInt(r.completed),
    failed: parseInt(r.failed),
    dead: parseInt(r.dead),
    avg_processing_ms: parseInt(r.avg_processing_ms),
    success_rate: done > 0 ? Math.round((parseInt(r.completed) / done) * 100) : 0,
  };
}
