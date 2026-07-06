"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const config_1 = require("../config");
const pool = new pg_1.Pool({
    connectionString: config_1.config.db.url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
pool.on('error', (err) => {
    console.error('[DB] Unexpected client error', err);
});
exports.default = pool;
//# sourceMappingURL=pool.js.map