import axios from 'axios';
import crypto from 'crypto';
import { Task } from '../types';
import { config } from '../config';
import { markWebhookDelivered, addTaskLog } from '../db/taskRepository';
import { logger } from '../utils/logger';

export async function deliverWebhook(task: Task): Promise<void> {
  if (!task.webhook_url || task.webhook_delivered) return;

  const payload = {
    task_id: task.id,
    type: task.type,
    status: task.status,
    result: task.result,
    error_message: task.error_message,
    completed_at: task.completed_at,
  };

  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', config.webhook.secret)
    .update(body)
    .digest('hex');

  try {
    await axios.post(task.webhook_url, payload, {
      timeout: config.webhook.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'X-JobQueue-Signature': `sha256=${signature}`,
        'X-JobQueue-TaskId': task.id,
        'X-JobQueue-Event': 'task.completed',
      },
    });

    await markWebhookDelivered(task.id);
    await addTaskLog({
      task_id: task.id,
      event: 'webhook_delivered',
      message: `Webhook delivered to ${task.webhook_url}`,
    });
    logger.info('Webhook', `Delivered for task ${task.id} → ${task.webhook_url}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Webhook', `Failed for task ${task.id}: ${msg}`);
    await addTaskLog({
      task_id: task.id,
      event: 'webhook_failed',
      message: `Webhook delivery failed: ${msg}`,
      metadata: { url: task.webhook_url },
    });
  }
}
