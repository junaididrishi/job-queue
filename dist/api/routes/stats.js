"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const taskRepository_1 = require("../../db/taskRepository");
const workerRepository_1 = require("../../db/workerRepository");
const queue_1 = require("../../queue/queue");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, async (_req, res) => {
    try {
        const [dbStats, queueDepths, workers] = await Promise.all([
            (0, taskRepository_1.getStats)(),
            (0, queue_1.getQueueDepths)(),
            (0, workerRepository_1.listWorkers)(),
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
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
exports.default = router;
//# sourceMappingURL=stats.js.map