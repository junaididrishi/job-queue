import 'dotenv/config';
import os from 'os';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { connectRedis, disconnectRedis } from '../queue/redis';
import { dequeue, enqueue, enqueueDeadLetter } from '../queue/queue';
import {
  getTaskById,
  updateTaskStatus,
  addTaskLog,
} from '../db/taskRepository';
import {
  registerWorker,
  heartbeat,
  setWorkerStatus,
  incrementWorkerStats,
  markWorkerOffline,
} from '../db/workerRepository';
import { executeJob } from './executor';
import { deliverWebhook } from './webhook';
import { logger } from '../utils/logger';

const WORKER_ID = randomUUID();
const HOSTNAME = os.hostname();
const CTX = 'Worker';

// Exponential backoff: delay = base * 2^attempt, capped at 1 hour
function retryDelayMs(attempt: number): number {
  const base = 5_000; // 5s
  const cap = 3_600_000; // 1h
  return Math.min(base * Math.pow(2, attempt), cap);
}

let running = true;
let activeJobs = 0;

async function processOne(): Promise<void> {
  const message = await dequeue(config.worker.pollTimeoutSeconds);
  if (!message) return; // timeout — loop again

  const task = await getTaskById(message.task_id);
  if (!task) {
    logger.warn(CTX, `Task ${message.task_id} not found in DB — skipping`);
    return;
  }

  // Guard: task may have been cancelled or already picked up by another worker
  if (task.status !== 'pending' && task.status !== 'failed') {
    logger.warn(CTX, `Task ${task.id} status=${task.status} — skipping`);
    return;
  }

  activeJobs++;
  const startedAt = new Date();
  logger.info(CTX, `Processing task ${task.id} type=${task.type} priority=${task.priority} attempt=${task.retry_count + 1}`);

  await setWorkerStatus(WORKER_ID, 'busy', task.id);
  await updateTaskStatus(task.id, 'processing', {
    worker_id: WORKER_ID,
    started_at: startedAt,
  });
  await addTaskLog({
    task_id: task.id,
    worker_id: WORKER_ID,
    event: 'processing_started',
    message: `Worker ${WORKER_ID} started processing on ${HOSTNAME}`,
  });

  try {
    const result = await executeJob(task);
    const completedAt = new Date();

    await updateTaskStatus(task.id, 'completed', {
      result,
      completed_at: completedAt,
    });
    await incrementWorkerStats(WORKER_ID, true);
    await addTaskLog({
      task_id: task.id,
      worker_id: WORKER_ID,
      event: 'completed',
      message: `Task completed in ${completedAt.getTime() - startedAt.getTime()}ms`,
      metadata: { duration_ms: completedAt.getTime() - startedAt.getTime() },
    });

    logger.info(CTX, `Task ${task.id} completed in ${completedAt.getTime() - startedAt.getTime()}ms`);

    // Deliver webhook if configured
    const updatedTask = await getTaskById(task.id);
    if (updatedTask) await deliverWebhook(updatedTask);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newRetryCount = task.retry_count + 1;

    logger.warn(CTX, `Task ${task.id} failed (attempt ${newRetryCount}/${task.max_retries}): ${errorMsg}`);
    await incrementWorkerStats(WORKER_ID, false);

    if (newRetryCount >= task.max_retries) {
      // Permanently failed — move to dead letter
      await updateTaskStatus(task.id, 'dead', {
        error_message: errorMsg,
        retry_count: newRetryCount,
      });
      await enqueueDeadLetter(task.id, errorMsg);
      await addTaskLog({
        task_id: task.id,
        worker_id: WORKER_ID,
        event: 'dead_lettered',
        message: `Task permanently failed after ${newRetryCount} attempts: ${errorMsg}`,
        metadata: { error: errorMsg, attempts: newRetryCount },
      });
      logger.error(CTX, `Task ${task.id} dead-lettered after ${newRetryCount} attempts`);

      const deadTask = await getTaskById(task.id);
      if (deadTask) await deliverWebhook(deadTask);
    } else {
      // Schedule retry with exponential backoff
      const delayMs = retryDelayMs(newRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await updateTaskStatus(task.id, 'failed', {
        error_message: errorMsg,
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt,
      });
      await addTaskLog({
        task_id: task.id,
        worker_id: WORKER_ID,
        event: 'failed',
        message: `Task failed, retry ${newRetryCount}/${task.max_retries} scheduled in ${delayMs / 1000}s`,
        metadata: { error: errorMsg, retry_in_ms: delayMs, next_retry_at: nextRetryAt },
      });

      // Re-enqueue after delay
      setTimeout(async () => {
        await updateTaskStatus(task.id, 'pending', { retry_count: newRetryCount });
        await enqueue(task.id, task.type, task.priority);
        logger.info(CTX, `Task ${task.id} re-enqueued for retry ${newRetryCount + 1}`);
      }, delayMs);
    }
  } finally {
    activeJobs--;
    await setWorkerStatus(WORKER_ID, 'idle', null);
  }
}

async function main() {
  logger.info(CTX, `Starting worker ${WORKER_ID} on ${HOSTNAME} pid=${process.pid}`);

  await connectRedis();
  await registerWorker(WORKER_ID, HOSTNAME, process.pid);

  // Heartbeat — lets the dashboard show live worker status
  const heartbeatInterval = setInterval(async () => {
    try { await heartbeat(WORKER_ID); } catch { /* non-fatal */ }
  }, config.worker.heartbeatIntervalMs);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(CTX, `${signal} received — shutting down gracefully`);
    running = false;
    clearInterval(heartbeatInterval);

    // Wait for active jobs to finish (max 30s)
    const deadline = Date.now() + 30_000;
    while (activeJobs > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }

    await markWorkerOffline(WORKER_ID);
    await disconnectRedis();
    logger.info(CTX, 'Worker shut down cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info(CTX, `Polling queues: high → normal → low (${config.worker.pollTimeoutSeconds}s timeout)`);

  // Main poll loop — single-threaded sequential processing
  // For concurrency, run multiple worker processes (each is independent)
  while (running) {
    try {
      await processOne();
    } catch (err) {
      logger.error(CTX, 'Unexpected error in poll loop', err);
      await new Promise((r) => setTimeout(r, 1_000)); // brief backoff on unexpected errors
    }
  }
}

main();
