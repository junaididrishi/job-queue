import pool from './pool';
import { Worker } from '../types';

export async function registerWorker(id: string, hostname: string, pid: number): Promise<Worker> {
  const { rows } = await pool.query<Worker>(
    `INSERT INTO workers (id, hostname, pid, status)
     VALUES ($1, $2, $3, 'idle')
     ON CONFLICT (id) DO UPDATE SET hostname = $2, pid = $3, status = 'idle', last_heartbeat = NOW()
     RETURNING *`,
    [id, hostname, pid]
  );
  return rows[0];
}

export async function heartbeat(id: string): Promise<void> {
  await pool.query('UPDATE workers SET last_heartbeat = NOW() WHERE id = $1', [id]);
}

export async function setWorkerStatus(
  id: string,
  status: Worker['status'],
  currentTaskId?: string | null
): Promise<void> {
  await pool.query(
    `UPDATE workers SET status = $2, current_task_id = $3, last_heartbeat = NOW() WHERE id = $1`,
    [id, status, currentTaskId ?? null]
  );
}

export async function incrementWorkerStats(id: string, success: boolean): Promise<void> {
  const col = success ? 'tasks_processed' : 'tasks_failed';
  await pool.query(`UPDATE workers SET ${col} = ${col} + 1 WHERE id = $1`, [id]);
}

export async function markWorkerOffline(id: string): Promise<void> {
  await pool.query(
    `UPDATE workers SET status = 'offline', current_task_id = NULL WHERE id = $1`,
    [id]
  );
}

export async function listWorkers(): Promise<Worker[]> {
  const { rows } = await pool.query<Worker>(
    'SELECT * FROM workers ORDER BY created_at DESC'
  );
  return rows;
}
