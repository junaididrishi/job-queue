import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  createTask,
  getTaskById,
  listTasks,
  getTaskLogs,
} from '../../db/taskRepository';
import { enqueue } from '../../queue/queue';
import { CreateTaskRequest, TaskPriority, TaskStatus, TaskType } from '../../types';

const router = Router();

const VALID_TYPES: TaskType[] = ['email', 'image_resize', 'report_generation', 'data_export', 'notification'];
const VALID_PRIORITIES: TaskPriority[] = ['high', 'normal', 'low'];

// POST /api/tasks — enqueue a new task
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as CreateTaskRequest;

  if (!body.type || !VALID_TYPES.includes(body.type)) {
    res.status(400).json({
      error: `Invalid task type. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
    return;
  }
  if (!body.payload || typeof body.payload !== 'object') {
    res.status(400).json({ error: 'payload must be a JSON object' });
    return;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    res.status(400).json({
      error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
    });
    return;
  }

  const id = randomUUID();
  const priority = body.priority ?? 'normal';
  const maxRetries = body.max_retries ?? 3;

  try {
    const task = await createTask({
      id,
      type: body.type,
      priority,
      payload: body.payload,
      max_retries: maxRetries,
      webhook_url: body.webhook_url,
    });

    // Push to the appropriate Redis queue
    await enqueue(id, body.type, priority);

    res.status(202).json({
      task_id: task.id,
      status: task.status,
      priority: task.priority,
      type: task.type,
      created_at: task.created_at,
      message: 'Task enqueued successfully',
    });
  } catch {
    res.status(500).json({ error: 'Failed to enqueue task' });
  }
});

// GET /api/tasks — list tasks with optional filters
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as TaskStatus | undefined;
  const type = req.query.type as string | undefined;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  if (limit > 100) {
    res.status(400).json({ error: 'limit cannot exceed 100' });
    return;
  }

  try {
    const { tasks, total } = await listTasks({ status, type, limit, offset });
    res.json({
      tasks,
      pagination: { total, limit, offset, has_more: offset + limit < total },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id — get single task with logs
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await getTaskById(req.params['id'] as string);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const logs = await getTaskLogs(task.id);
    res.json({ ...task, logs });
  } catch {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

export default router;
