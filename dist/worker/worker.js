"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
const config_1 = require("../config");
const redis_1 = require("../queue/redis");
const queue_1 = require("../queue/queue");
const taskRepository_1 = require("../db/taskRepository");
const workerRepository_1 = require("../db/workerRepository");
const executor_1 = require("./executor");
const webhook_1 = require("./webhook");
const logger_1 = require("../utils/logger");
const WORKER_ID = (0, crypto_1.randomUUID)();
const HOSTNAME = os_1.default.hostname();
const CTX = 'Worker';
// Exponential backoff: delay = base * 2^attempt, capped at 1 hour
function retryDelayMs(attempt) {
    const base = 5000; // 5s
    const cap = 3600000; // 1h
    return Math.min(base * Math.pow(2, attempt), cap);
}
let running = true;
let activeJobs = 0;
async function processOne() {
    const message = await (0, queue_1.dequeue)(config_1.config.worker.pollTimeoutSeconds);
    if (!message)
        return; // timeout — loop again
    const task = await (0, taskRepository_1.getTaskById)(message.task_id);
    if (!task) {
        logger_1.logger.warn(CTX, `Task ${message.task_id} not found in DB — skipping`);
        return;
    }
    // Guard: task may have been cancelled or already picked up by another worker
    if (task.status !== 'pending' && task.status !== 'failed') {
        logger_1.logger.warn(CTX, `Task ${task.id} status=${task.status} — skipping`);
        return;
    }
    activeJobs++;
    const startedAt = new Date();
    logger_1.logger.info(CTX, `Processing task ${task.id} type=${task.type} priority=${task.priority} attempt=${task.retry_count + 1}`);
    await (0, workerRepository_1.setWorkerStatus)(WORKER_ID, 'busy', task.id);
    await (0, taskRepository_1.updateTaskStatus)(task.id, 'processing', {
        worker_id: WORKER_ID,
        started_at: startedAt,
    });
    await (0, taskRepository_1.addTaskLog)({
        task_id: task.id,
        worker_id: WORKER_ID,
        event: 'processing_started',
        message: `Worker ${WORKER_ID} started processing on ${HOSTNAME}`,
    });
    try {
        const result = await (0, executor_1.executeJob)(task);
        const completedAt = new Date();
        await (0, taskRepository_1.updateTaskStatus)(task.id, 'completed', {
            result,
            completed_at: completedAt,
        });
        await (0, workerRepository_1.incrementWorkerStats)(WORKER_ID, true);
        await (0, taskRepository_1.addTaskLog)({
            task_id: task.id,
            worker_id: WORKER_ID,
            event: 'completed',
            message: `Task completed in ${completedAt.getTime() - startedAt.getTime()}ms`,
            metadata: { duration_ms: completedAt.getTime() - startedAt.getTime() },
        });
        logger_1.logger.info(CTX, `Task ${task.id} completed in ${completedAt.getTime() - startedAt.getTime()}ms`);
        // Deliver webhook if configured
        const updatedTask = await (0, taskRepository_1.getTaskById)(task.id);
        if (updatedTask)
            await (0, webhook_1.deliverWebhook)(updatedTask);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const newRetryCount = task.retry_count + 1;
        logger_1.logger.warn(CTX, `Task ${task.id} failed (attempt ${newRetryCount}/${task.max_retries}): ${errorMsg}`);
        await (0, workerRepository_1.incrementWorkerStats)(WORKER_ID, false);
        if (newRetryCount >= task.max_retries) {
            // Permanently failed — move to dead letter
            await (0, taskRepository_1.updateTaskStatus)(task.id, 'dead', {
                error_message: errorMsg,
                retry_count: newRetryCount,
            });
            await (0, queue_1.enqueueDeadLetter)(task.id, errorMsg);
            await (0, taskRepository_1.addTaskLog)({
                task_id: task.id,
                worker_id: WORKER_ID,
                event: 'dead_lettered',
                message: `Task permanently failed after ${newRetryCount} attempts: ${errorMsg}`,
                metadata: { error: errorMsg, attempts: newRetryCount },
            });
            logger_1.logger.error(CTX, `Task ${task.id} dead-lettered after ${newRetryCount} attempts`);
            const deadTask = await (0, taskRepository_1.getTaskById)(task.id);
            if (deadTask)
                await (0, webhook_1.deliverWebhook)(deadTask);
        }
        else {
            // Schedule retry with exponential backoff
            const delayMs = retryDelayMs(newRetryCount);
            const nextRetryAt = new Date(Date.now() + delayMs);
            await (0, taskRepository_1.updateTaskStatus)(task.id, 'failed', {
                error_message: errorMsg,
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt,
            });
            await (0, taskRepository_1.addTaskLog)({
                task_id: task.id,
                worker_id: WORKER_ID,
                event: 'failed',
                message: `Task failed, retry ${newRetryCount}/${task.max_retries} scheduled in ${delayMs / 1000}s`,
                metadata: { error: errorMsg, retry_in_ms: delayMs, next_retry_at: nextRetryAt },
            });
            // Re-enqueue after delay
            setTimeout(async () => {
                await (0, taskRepository_1.updateTaskStatus)(task.id, 'pending', { retry_count: newRetryCount });
                await (0, queue_1.enqueue)(task.id, task.type, task.priority);
                logger_1.logger.info(CTX, `Task ${task.id} re-enqueued for retry ${newRetryCount + 1}`);
            }, delayMs);
        }
    }
    finally {
        activeJobs--;
        await (0, workerRepository_1.setWorkerStatus)(WORKER_ID, 'idle', null);
    }
}
async function main() {
    logger_1.logger.info(CTX, `Starting worker ${WORKER_ID} on ${HOSTNAME} pid=${process.pid}`);
    await (0, redis_1.connectRedis)();
    await (0, workerRepository_1.registerWorker)(WORKER_ID, HOSTNAME, process.pid);
    // Heartbeat — lets the dashboard show live worker status
    const heartbeatInterval = setInterval(async () => {
        try {
            await (0, workerRepository_1.heartbeat)(WORKER_ID);
        }
        catch { /* non-fatal */ }
    }, config_1.config.worker.heartbeatIntervalMs);
    // Graceful shutdown
    const shutdown = async (signal) => {
        logger_1.logger.info(CTX, `${signal} received — shutting down gracefully`);
        running = false;
        clearInterval(heartbeatInterval);
        // Wait for active jobs to finish (max 30s)
        const deadline = Date.now() + 30000;
        while (activeJobs > 0 && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 500));
        }
        await (0, workerRepository_1.markWorkerOffline)(WORKER_ID);
        await (0, redis_1.disconnectRedis)();
        logger_1.logger.info(CTX, 'Worker shut down cleanly');
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    logger_1.logger.info(CTX, `Polling queues: high → normal → low (${config_1.config.worker.pollTimeoutSeconds}s timeout)`);
    // Main poll loop — single-threaded sequential processing
    // For concurrency, run multiple worker processes (each is independent)
    while (running) {
        try {
            await processOne();
        }
        catch (err) {
            logger_1.logger.error(CTX, 'Unexpected error in poll loop', err);
            await new Promise((r) => setTimeout(r, 1000)); // brief backoff on unexpected errors
        }
    }
}
main();
//# sourceMappingURL=worker.js.map