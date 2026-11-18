import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required; verification was not attempted.');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 1,
});

try {
  const result = await pool.query<{
    version: string;
    state_sha256: string;
    products: number;
    subscribers: number;
    subscriptions: number;
    backups: number;
  }>(
    `SELECT
      version,
      state_sha256,
      jsonb_array_length(state->'products')::int AS products,
      jsonb_array_length(state->'subscribers')::int AS subscribers,
      jsonb_array_length(state->'subscriptions')::int AS subscriptions,
      (SELECT COUNT(*)::int FROM hub_state_backups) AS backups
     FROM hub_state WHERE singleton_id = 'default'`,
  );
  if (result.rowCount !== 1) throw new Error('hub_state singleton row is missing.');
  console.log(JSON.stringify({ verified: true, ...result.rows[0] }, null, 2));
} finally {
  await pool.end();
}
