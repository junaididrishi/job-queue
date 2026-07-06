"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const config_1 = require("../config");
const redis_1 = require("../queue/redis");
const dashboard_1 = require("../dashboard");
const auth_1 = __importDefault(require("./routes/auth"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const stats_1 = __importDefault(require("./routes/stats"));
const logger_1 = require("../utils/logger");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Basic request logging
app.use((req, _res, next) => {
    logger_1.logger.info('HTTP', `${req.method} ${req.path}`);
    next();
});
// Health check — no auth required (used by Railway/Docker health checks)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() });
});
// Dashboard — served at root, no auth at HTTP level (JS handles login)
app.get('/dashboard', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send((0, dashboard_1.getDashboardHTML)());
});
// Redirect root to dashboard
app.get('/', (_req, res) => res.redirect('/dashboard'));
// API routes
app.use('/api/auth', auth_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/stats', stats_1.default);
// 404
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    logger_1.logger.error('Server', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error' });
});
async function start() {
    await (0, redis_1.connectRedis)();
    app.listen(config_1.config.port, () => {
        logger_1.logger.info('Server', `API running on http://localhost:${config_1.config.port}`);
        logger_1.logger.info('Server', `Dashboard: http://localhost:${config_1.config.port}/dashboard`);
        logger_1.logger.info('Server', `Health: http://localhost:${config_1.config.port}/health`);
    });
}
start().catch((err) => {
    logger_1.logger.error('Server', 'Failed to start', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map