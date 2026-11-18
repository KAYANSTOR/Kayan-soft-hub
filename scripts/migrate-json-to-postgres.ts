import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import type { HubStateSnapshot } from '../src/shared/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const storePath = path.join(dataDir, 'kayan-hub-store.json');
const backupsDir = path.join(dataDir, 'backups');
const schemaPath = path.join(root, 'db/migrations/001_hub_state.sql');

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required; no migration was attempted.');
  return value;
}

const databaseUrl = requireDatabaseUrl();
const stateRaw = fs.readFileSync(storePath, 'utf8');
const state = JSON.parse(stateRaw) as HubStateSnapshot;
const stateHash = sha256(stateRaw);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 2,
});

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(schemaPath, 'utf8'));

    const existing = await client.query<{ state_sha256: string; version: string }>(
      "SELECT state_sha256, version FROM hub_state WHERE singleton_id = 'default' FOR UPDATE",
    );
    if (existing.rowCount && existing.rows[0].state_sha256 !== stateHash && process.env.ALLOW_MIGRATION_OVERWRITE !== 'true') {
      throw new Error(
        'hub_state already contains different data. Set ALLOW_MIGRATION_OVERWRITE=true only after reviewing the existing database backup.',
      );
    }

    await client.query(
      `INSERT INTO hub_state (singleton_id, version, state, state_sha256, updated_at)
       VALUES ('default', 1, $1::jsonb, $2, NOW())
       ON CONFLICT (singleton_id) DO UPDATE SET
         version = hub_state.version + 1,
         state = EXCLUDED.state,
         state_sha256 = EXCLUDED.state_sha256,
         updated_at = NOW()`,
      [stateRaw, stateHash],
    );

    let importedBackups = 0;
    for (const metadata of state.backupsMeta) {
      const backupPath = path.join(backupsDir, `${metadata.id}.json`);
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup payload is missing for ${metadata.id}`);
      }
      const backupRaw = fs.readFileSync(backupPath, 'utf8');
      await client.query(
        `INSERT INTO hub_state_backups
          (id, state, state_sha256, created_at, created_by, reason, size_bytes, checksum)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           state = EXCLUDED.state,
           state_sha256 = EXCLUDED.state_sha256,
           created_at = EXCLUDED.created_at,
           created_by = EXCLUDED.created_by,
           reason = EXCLUDED.reason,
           size_bytes = EXCLUDED.size_bytes,
           checksum = EXCLUDED.checksum`,
        [metadata.id, backupRaw, sha256(backupRaw), metadata.createdAt, metadata.createdBy, metadata.reason, metadata.sizeBytes, metadata.checksum],
      );
      importedBackups += 1;
    }

    const counts = await client.query<{ products: number; subscribers: number; subscriptions: number; backups: number }>(
      `SELECT
        jsonb_array_length(state->'products')::int AS products,
        jsonb_array_length(state->'subscribers')::int AS subscribers,
        jsonb_array_length(state->'subscriptions')::int AS subscriptions,
        (SELECT COUNT(*)::int FROM hub_state_backups) AS backups
       FROM hub_state WHERE singleton_id = 'default'`,
    );
    await client.query('COMMIT');
    console.log(JSON.stringify({ migrated: true, stateHash, importedBackups, counts: counts.rows[0] }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
