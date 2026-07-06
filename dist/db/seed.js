"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("./pool"));
const bcrypt_1 = __importDefault(require("bcrypt"));
async function seed() {
    const client = await pool_1.default.connect();
    try {
        console.log('[DB] Seeding...');
        const hash = await bcrypt_1.default.hash('password123', 10);
        await client.query(`INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`, ['admin@jobqueue.dev', hash, 'Admin User']);
        console.log('[DB] Seed complete. User: admin@jobqueue.dev / password123');
    }
    finally {
        client.release();
        await pool_1.default.end();
    }
}
seed().catch((err) => {
    console.error('[DB] Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map