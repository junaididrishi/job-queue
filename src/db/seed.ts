import pool from './pool';
import bcrypt from 'bcrypt';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('[DB] Seeding...');
    const hash = await bcrypt.hash('password123', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@jobqueue.dev', hash, 'Admin User']
    );
    console.log('[DB] Seed complete. User: admin@jobqueue.dev / password123');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[DB] Seed failed:', err);
  process.exit(1);
});
