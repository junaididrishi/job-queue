"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorker = registerWorker;
exports.heartbeat = heartbeat;
exports.setWorkerStatus = setWorkerStatus;
exports.incrementWorkerStats = incrementWorkerStats;
exports.markWorkerOffline = markWorkerOffline;
exports.listWorkers = listWorkers;
const pool_1 = __importDefault(require("./pool"));
async function registerWorker(id, hostname, pid) {
    const { rows } = await pool_1.default.query(`INSERT INTO workers (id, hostname, pid, status)
     VALUES ($1, $2, $3, 'idle')
     ON CONFLICT (id) DO UPDATE SET hostname = $2, pid = $3, status = 'idle', last_heartbeat = NOW()
     RETURNING *`, [id, hostname, pid]);
    return rows[0];
}
async function heartbeat(id) {
    await pool_1.default.query('UPDATE workers SET last_heartbeat = NOW() WHERE id = $1', [id]);
}
async function setWorkerStatus(id, status, currentTaskId) {
    await pool_1.default.query(`UPDATE workers SET status = $2, current_task_id = $3, last_heartbeat = NOW() WHERE id = $1`, [id, status, currentTaskId ?? null]);
}
async function incrementWorkerStats(id, success) {
    const col = success ? 'tasks_processed' : 'tasks_failed';
    await pool_1.default.query(`UPDATE workers SET ${col} = ${col} + 1 WHERE id = $1`, [id]);
}
async function markWorkerOffline(id) {
    await pool_1.default.query(`UPDATE workers SET status = 'offline', current_task_id = NULL WHERE id = $1`, [id]);
}
async function listWorkers() {
    const { rows } = await pool_1.default.query('SELECT * FROM workers ORDER BY created_at DESC');
    return rows;
}
//# sourceMappingURL=workerRepository.js.map