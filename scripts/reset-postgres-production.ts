import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { createInitialHubState, hashPassword } from '../src/server/repositories/seedData.js';
import type { HubStateSnapshot } from '../src/shared/types.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
const adminEmail = process.env.HUB_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.HUB_ADMIN_PASSWORD;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (!adminEmail || !adminPassword) throw new Error('HUB_ADMIN_EMAIL and HUB_ADMIN_PASSWORD are required.');
if (adminPassword.length < 8) throw new Error('HUB_ADMIN_PASSWORD must be at least 8 characters.');

const template = createInitialHubState();
const now = new Date().toISOString();
const state: HubStateSnapshot = {
  ...template,
  products: [],
  subscribers: [],
  subscriptions: [],
  plans: [],
  payments: [],
  pages: [],
  articles: [],
  projects: [],
  services: [],
  media: [],
  redirects: [],
  leads: [],
  tasks: [],
  users: [{
    id: `usr-owner-${crypto.randomBytes(8).toString('hex')}`,
    name: 'مدير مؤسسة كيان سوفت',
    email: adminEmail,
    role: 'owner',
    active: true,
    mfaEnabled: false,
    allowedProductIds: [],
    lastLoginAt: '',
    passwordHash: hashPassword(adminPassword),
  }],
  auditLogs: [{
    id: `aud-${Date.now()}`,
    timestamp: now,
    actorId: 'system',
    actorName: 'تهيئة الإنتاج',
    actorRole: 'owner',
    action: 'تهيئة قاعدة الإنتاج',
    module: 'النظام',
    targetId: 'default',
    targetLabel: 'حالة المنصة',
    referenceId: `REF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    details: 'تم حذف بيانات Seed والتجارب وإنشاء حساب الإدارة الأول. لا توجد بيانات منتجات أو عملاء مستوردة.',
    status: 'success',
  }],
  syncLogs: [],
  processedWebhookNonces: [],
  backupsMeta: [],
  websiteSettings: {
    ...template.websiteSettings,
    orgName: 'Kayan Soft',
    tagline: '',
    email: adminEmail,
    phone: '',
    whatsappNumber: '',
    address: '',
    socialLinks: { github: 'https://github.com/KAYANSTOR', linkedin: '', x: '' },
    announcementBanner: '',
    announcementEnabled: false,
    primaryNavigation: [],
    footerLegalNote: '',
    robotsTxt: 'User-agent: *\nDisallow: /',
  },
  orgSettings: {
    ...template.orgSettings,
    companyName: 'Kayan Soft',
    legalEntity: '',
    crmStages: [],
    exchangeRates: [],
  },
};

const raw = JSON.stringify(state);
const hash = crypto.createHash('sha256').update(raw).digest('hex');
const schemaPath = path.resolve(process.cwd(), 'db/migrations/001_hub_state.sql');
const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, max: 1 });
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(schemaPath, 'utf8'));
    await client.query('TRUNCATE TABLE hub_state_backups');
    await client.query(
      `INSERT INTO hub_state (singleton_id, version, state, state_sha256, updated_at)
       VALUES ('default', 1, $1::jsonb, $2, NOW())
       ON CONFLICT (singleton_id) DO UPDATE SET
         version = hub_state.version + 1,
         state = EXCLUDED.state,
         state_sha256 = EXCLUDED.state_sha256,
         updated_at = NOW()`,
      [raw, hash],
    );
    await client.query('COMMIT');
    console.log(JSON.stringify({ reset: true, products: 0, subscribers: 0, subscriptions: 0, cms: 0, backups: 0, adminEmail }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
