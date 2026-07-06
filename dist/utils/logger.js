"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const config_1 = require("../config");
function log(level, context, message, meta) {
    const ts = new Date().toISOString();
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    const line = `[${ts}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
    if (level === 'error')
        console.error(line);
    else if (level === 'warn')
        console.warn(line);
    else if (level === 'debug' && config_1.config.nodeEnv === 'production')
        return;
    else
        console.log(line);
}
exports.logger = {
    info: (ctx, msg, meta) => log('info', ctx, msg, meta),
    warn: (ctx, msg, meta) => log('warn', ctx, msg, meta),
    error: (ctx, msg, meta) => log('error', ctx, msg, meta),
    debug: (ctx, msg, meta) => log('debug', ctx, msg, meta),
};
//# sourceMappingURL=logger.js.map