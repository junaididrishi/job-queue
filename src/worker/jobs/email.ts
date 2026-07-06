import { Task } from '../../types';

export async function handleEmail(task: Task): Promise<Record<string, unknown>> {
  const { to, subject, body } = task.payload as { to: string; subject: string; body: string };
  if (!to || !subject) throw new Error('Missing required fields: to, subject');

  // Simulate SMTP send with realistic latency
  await sleep(300 + Math.random() * 400);

  // Simulate occasional transient failures (10% chance) to demonstrate retry logic
  if (Math.random() < 0.10) throw new Error('SMTP connection timeout');

  return {
    message_id: `msg_${Date.now()}`,
    to,
    subject,
    sent_at: new Date().toISOString(),
    provider: 'simulated-smtp',
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
