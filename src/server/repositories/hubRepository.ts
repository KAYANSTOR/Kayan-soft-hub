import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BackupSnapshot, HubStateSnapshot } from '../../shared/types';
import { createInitialHubState } from './seedData';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'kayan-hub-store.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

export class HubRepository {
  private ensureDirs(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  }

  public readState(): HubStateSnapshot {
    this.ensureDirs();
    if (!fs.existsSync(STORE_FILE)) {
      const initial = createInitialHubState();
      this.writeState(initial);
      // Also write initial baseline backup file if missing
      const initBackupPath = path.join(BACKUPS_DIR, `${initial.backupsMeta[0].id}.json`);
      if (!fs.existsSync(initBackupPath)) {
        fs.writeFileSync(initBackupPath, JSON.stringify(initial, null, 2), 'utf8');
      }
      return initial;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw) as HubStateSnapshot;
  }

  public writeState(state: HubStateSnapshot): void {
    this.ensureDirs();
    const tmpFile = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpFile, STORE_FILE);
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
    const filePath = path.join(BACKUPS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, payload, 'utf8');
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
