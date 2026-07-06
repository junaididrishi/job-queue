"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverWebhook = deliverWebhook;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const taskRepository_1 = require("../db/taskRepository");
const logger_1 = require("../utils/logger");
async function deliverWebhook(task) {
    if (!task.webhook_url || task.webhook_delivered)
        return;
    const payload = {
        task_id: task.id,
        type: task.type,
        status: task.status,
        result: task.result,
        error_message: task.error_message,
        completed_at: task.completed_at,
    };
    const body = JSON.stringify(payload);
    const signature = crypto_1.default
        .createHmac('sha256', config_1.config.webhook.secret)
        .update(body)
        .digest('hex');
    try {
        await axios_1.default.post(task.webhook_url, payload, {
            timeout: config_1.config.webhook.timeoutMs,
            headers: {
                'Content-Type': 'application/json',
                'X-JobQueue-Signature': `sha256=${signature}`,
                'X-JobQueue-TaskId': task.id,
                'X-JobQueue-Event': 'task.completed',
            },
        });
        await (0, taskRepository_1.markWebhookDelivered)(task.id);
        await (0, taskRepository_1.addTaskLog)({
            task_id: task.id,
            event: 'webhook_delivered',
            message: `Webhook delivered to ${task.webhook_url}`,
        });
        logger_1.logger.info('Webhook', `Delivered for task ${task.id} → ${task.webhook_url}`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger_1.logger.warn('Webhook', `Failed for task ${task.id}: ${msg}`);
        await (0, taskRepository_1.addTaskLog)({
            task_id: task.id,
            event: 'webhook_failed',
            message: `Webhook delivery failed: ${msg}`,
            metadata: { url: task.webhook_url },
        });
    }
}
//# sourceMappingURL=webhook.js.map