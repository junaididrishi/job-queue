"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    db: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/job_queue',
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    worker: {
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
        pollTimeoutSeconds: parseInt(process.env.WORKER_POLL_TIMEOUT || '5'),
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        heartbeatIntervalMs: 10000,
    },
    webhook: {
        secret: process.env.WEBHOOK_SECRET || 'webhook-secret',
        timeoutMs: 10000,
    },
    queue: {
        highPriority: 'tasks:high',
        normalPriority: 'tasks:normal',
        lowPriority: 'tasks:low',
        deadLetter: 'tasks:dead',
    },
};
//# sourceMappingURL=index.js.map