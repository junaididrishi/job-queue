import { Task } from '../../types';

export async function handleNotification(task: Task): Promise<Record<string, unknown>> {
  const { channel, recipient, title, message } = task.payload as {
    channel: 'push' | 'sms' | 'in_app';
    recipient: string;
    title: string;
    message: string;
  };
  if (!channel || !recipient || !message) {
    throw new Error('Missing required fields: channel, recipient, message');
  }

  await sleep(100 + Math.random() * 200);

  return {
    notification_id: `ntf_${Date.now()}`,
    channel,
    recipient,
    title: title || 'Notification',
    delivered: true,
    sent_at: new Date().toISOString(),
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
