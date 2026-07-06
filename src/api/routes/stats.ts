import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getStats } from '../../db/taskRepository';
import { listWorkers } from '../../db/workerRepository';
import { getQueueDepths } from '../../queue/queue';

const router = Router();

router.get('/', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [dbStats, queueDepths, workers] = await Promise.all([
      getStats(),
      getQueueDepths(),
      listWorkers(),
    ]);

    res.json({
      tasks: dbStats,
      queue: queueDepths,
      workers: {
        total: workers.length,
        idle: workers.filter((w) => w.status === 'idle').length,
        busy: workers.filter((w) => w.status === 'busy').length,
        offline: workers.filter((w) => w.status === 'offline').length,
        list: workers,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
