"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueue = enqueue;
exports.dequeue = dequeue;
exports.enqueueDeadLetter = enqueueDeadLetter;
exports.getQueueDepths = getQueueDepths;
const redis_1 = require("./redis");
const config_1 = require("../config");
// Maps priority → Redis list key. LPUSH enqueues, BRPOP dequeues from right.
// Workers poll high → normal → low in order, giving strict priority.
function queueKey(priority) {
    switch (priority) {
        case 'high': return config_1.config.queue.highPriority;
        case 'low': return config_1.config.queue.lowPriority;
        default: return config_1.config.queue.normalPriority;
    }
}
async function enqueue(taskId, type, priority) {
    const message = {
        task_id: taskId,
        type: type,
        priority,
        enqueued_at: new Date().toISOString(),
    };
    const key = queueKey(priority);
    // LPUSH pushes to left; BRPOP pops from right → FIFO within same priority
    await redis_1.redisClient.lPush(key, JSON.stringify(message));
}
async function dequeue(timeoutSeconds) {
    // Poll high, normal, low in strict priority order (BRPOP is atomic and blocking)
    const result = await redis_1.redisClient.brPop([config_1.config.queue.highPriority, config_1.config.queue.normalPriority, config_1.config.queue.lowPriority], timeoutSeconds);
    if (!result)
        return null;
    return JSON.parse(result.element);
}
async function enqueueDeadLetter(taskId, reason) {
    const message = { task_id: taskId, reason, dead_at: new Date().toISOString() };
    await redis_1.redisClient.lPush(config_1.config.queue.deadLetter, JSON.stringify(message));
}
async function getQueueDepths() {
    const [high, normal, low, dead] = await Promise.all([
        redis_1.redisClient.lLen(config_1.config.queue.highPriority),
        redis_1.redisClient.lLen(config_1.config.queue.normalPriority),
        redis_1.redisClient.lLen(config_1.config.queue.lowPriority),
        redis_1.redisClient.lLen(config_1.config.queue.deadLetter),
    ]);
    return { high, normal, low, dead, total: high + normal + low };
}
//# sourceMappingURL=queue.js.map