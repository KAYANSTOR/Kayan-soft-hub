import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import type { BackupSnapshot, HubStateSnapshot } from '../../shared/types.js';
import { createInitialHubState } from './seedData.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'kayan-hub-store.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const SCHEMA_FILE = path.resolve(process.cwd(), 'db/migrations/001_hub_state.sql');

export class HubRepository {
  private readonly databaseUrl = process.env.DATABASE_URL?.trim();
  private readonly pool = process.env.VERCEL && this.databaseUrl
    ? new Pool({
        connectionString: this.databaseUrl,
        ssl: { rejectUnauthorized: false },
        max: 2,
      })
    : null;
  private state: HubStateSnapshot | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();
  private initialized = false;

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));
        const result = await client.query<{ state: HubStateSnapshot }>(
          "SELECT state FROM hub_state WHERE singleton_id = 'default'",
        );
        this.state = result.rows[0]?.state || createInitialHubState();
      } finally {
        client.release();
      }
    } else {
      this.state = this.readJsonState();
    }
    this.initialized = true;
  }

  private ensureDirs(): void {
    if (process.env.VERCEL) return;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  private readJsonState(): HubStateSnapshot {
    this.ensureDirs();
    if (!fs.existsSync(STORE_FILE)) {
      const initial = createInitialHubState();
      if (!process.env.VERCEL) {
        this.writeJsonState(initial);
        const initBackupPath = path.join(BACKUPS_DIR, `${initial.backupsMeta[0].id}.json`);
        if (!fs.existsSync(initBackupPath)) fs.writeFileSync(initBackupPath, JSON.stringify(initial, null, 2), 'utf8');
      }
      return initial;
    }
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as HubStateSnapshot;
  }

  private writeJsonState(state: HubStateSnapshot): void {
    this.ensureDirs();
    const tmpFile = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpFile, STORE_FILE);
  }

  public readState(): HubStateSnapshot {
    if (!this.state) this.state = this.readJsonState();
    return this.state;
  }

  public writeState(state: HubStateSnapshot): void {
    this.state = state;
    if (this.pool) {
      const stateRaw = JSON.stringify(state);
      const stateHash = crypto.createHash('sha256').update(stateRaw).digest('hex');
      this.pendingWrite = this.pendingWrite.then(async () => {
        await this.pool!.query(
          `INSERT INTO hub_state (singleton_id, version, state, state_sha256, updated_at)
           VALUES ('default', 1, $1::jsonb, $2, NOW())
           ON CONFLICT (singleton_id) DO UPDATE SET
             version = hub_state.version + 1,
             state = EXCLUDED.state,
             state_sha256 = EXCLUDED.state_sha256,
             updated_at = NOW()`,
          [stateRaw, stateHash],
        );
      });
      return;
    }
    this.writeJsonState(state);
  }

  public async flush(): Promise<void> {
    await this.pendingWrite;
  }

  public updateState<T>(mutator: (draft: HubStateSnapshot) => T): T {
    const current = this.readState();
    const result = mutator(current);
    this.writeState(current);
    return result;
  }

  public createBackupFile(state: HubStateSnapshot, createdBy: string, reason: string): BackupSnapshot {
    this.ensureDirs();
    const id = `bkp-${Date.now()}`;
    const payload = JSON.stringify(state, null, 2);
    const checksum = `sha256-${crypto.createHash('sha256').update(payload).digest('hex').slice(0, 12)}`;
    const snapshot: BackupSnapshot = {
      id,
      createdAt: new Date().toISOString(),
      createdBy,
      reason,
      sizeBytes: Buffer.byteLength(payload, 'utf8'),
      checksum,
    };
    if (this.pool) {
      this.pendingWrite = this.pendingWrite.then(async () => {
        await this.pool!.query(
          `INSERT INTO hub_state_backups
            (id, state, state_sha256, created_at, created_by, reason, size_bytes, checksum)
           VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [id, payload, crypto.createHash('sha256').update(payload).digest('hex'), snapshot.createdAt, createdBy, reason, snapshot.sizeBytes, checksum],
        );
      });
    } else {
      fs.writeFileSync(path.join(BACKUPS_DIR, `${id}.json`), payload, 'utf8');
    }
    return snapshot;
  }

  public readBackupPayload(backupId: string): HubStateSnapshot | null {
    this.ensureDirs();
    const safeId = backupId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(BACKUPS_DIR, `${safeId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as HubStateSnapshot;
  }
}

export const hubRepository = new HubRepository();
