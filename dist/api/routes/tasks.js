"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const auth_1 = require("../middleware/auth");
const taskRepository_1 = require("../../db/taskRepository");
const queue_1 = require("../../queue/queue");
const router = (0, express_1.Router)();
const VALID_TYPES = ['email', 'image_resize', 'report_generation', 'data_export', 'notification'];
const VALID_PRIORITIES = ['high', 'normal', 'low'];
// POST /api/tasks — enqueue a new task
router.post('/', auth_1.authenticate, async (req, res) => {
    const body = req.body;
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
    const id = (0, crypto_1.randomUUID)();
    const priority = body.priority ?? 'normal';
    const maxRetries = body.max_retries ?? 3;
    try {
        const task = await (0, taskRepository_1.createTask)({
            id,
            type: body.type,
            priority,
            payload: body.payload,
            max_retries: maxRetries,
            webhook_url: body.webhook_url,
        });
        // Push to the appropriate Redis queue
        await (0, queue_1.enqueue)(id, body.type, priority);
        res.status(202).json({
            task_id: task.id,
            status: task.status,
            priority: task.priority,
            type: task.type,
            created_at: task.created_at,
            message: 'Task enqueued successfully',
        });
    }
    catch {
        res.status(500).json({ error: 'Failed to enqueue task' });
    }
});
// GET /api/tasks — list tasks with optional filters
router.get('/', auth_1.authenticate, async (req, res) => {
    const status = req.query.status;
    const type = req.query.type;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    if (limit > 100) {
        res.status(400).json({ error: 'limit cannot exceed 100' });
        return;
    }
    try {
        const { tasks, total } = await (0, taskRepository_1.listTasks)({ status, type, limit, offset });
        res.json({
            tasks,
            pagination: { total, limit, offset, has_more: offset + limit < total },
        });
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});
// GET /api/tasks/:id — get single task with logs
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const task = await (0, taskRepository_1.getTaskById)(req.params['id']);
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const logs = await (0, taskRepository_1.getTaskLogs)(task.id);
        res.json({ ...task, logs });
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map