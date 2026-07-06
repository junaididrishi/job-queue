import { redisClient } from './redis';
import { config } from '../config';
import { TaskPriority, QueueMessage } from '../types';

// Maps priority → Redis list key. LPUSH enqueues, BRPOP dequeues from right.
// Workers poll high → normal → low in order, giving strict priority.
function queueKey(priority: TaskPriority): string {
  switch (priority) {
    case 'high': return config.queue.highPriority;
    case 'low': return config.queue.lowPriority;
    default: return config.queue.normalPriority;
  }
}

export async function enqueue(taskId: string, type: string, priority: TaskPriority): Promise<void> {
  const message: QueueMessage = {
    task_id: taskId,
    type: type as QueueMessage['type'],
    priority,
    enqueued_at: new Date().toISOString(),
  };
  const key = queueKey(priority);
  // LPUSH pushes to left; BRPOP pops from right → FIFO within same priority
  await redisClient.lPush(key, JSON.stringify(message));
}

export async function dequeue(timeoutSeconds: number): Promise<QueueMessage | null> {
  // Poll high, normal, low in strict priority order (BRPOP is atomic and blocking)
  const result = await redisClient.brPop(
    [config.queue.highPriority, config.queue.normalPriority, config.queue.lowPriority],
    timeoutSeconds
  );
  if (!result) return null;
  return JSON.parse(result.element) as QueueMessage;
}

export async function enqueueDeadLetter(taskId: string, reason: string): Promise<void> {
  const message = { task_id: taskId, reason, dead_at: new Date().toISOString() };
  await redisClient.lPush(config.queue.deadLetter, JSON.stringify(message));
}

export async function getQueueDepths(): Promise<Record<string, number>> {
  const [high, normal, low, dead] = await Promise.all([
    redisClient.lLen(config.queue.highPriority),
    redisClient.lLen(config.queue.normalPriority),
    redisClient.lLen(config.queue.lowPriority),
    redisClient.lLen(config.queue.deadLetter),
  ]);
  return { high, normal, low, dead, total: high + normal + low };
}
