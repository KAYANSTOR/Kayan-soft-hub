import type { EnterpriseProduct, SubscriptionRecord, SubscriptionStatus } from '../../shared/types.js';
import crypto from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 8_000;

type ConnectorCode = 'krotak-pro' | 'krotic-admin' | 'almothfin' | 'kayan-soft';

export interface VercelProductSyncOutcome {
  result: {
    status: 'success' | 'warning' | 'failed';
    connectorHealth: 'connected' | 'degraded' | 'offline';
    recordsSynced: number;
    message: string;
  };
  updates: Array<{
    subscriptionId: string;
    status: SubscriptionStatus;
    planId: string;
    planName: string;
    startDate?: string;
    endDate?: string;
  }>;
}

interface ConnectorConfig {
  urlEnv: string;
  pathEnv: string;
  defaultUrl: string;
  defaultPath: string;
  apiExpected: boolean;
}

const CONFIG: Record<ConnectorCode, ConnectorConfig> = {
  'krotak-pro': {
    urlEnv: 'KROTAK_API_URL',
    pathEnv: 'KROTAK_HEALTH_PATH',
    defaultUrl: 'https://krotak-pro.vercel.app',
    defaultPath: '/api/integration/health',
    apiExpected: true,
  },
  'krotic-admin': {
    urlEnv: 'KROTIC_ADMIN_API_URL',
    pathEnv: 'KROTIC_ADMIN_HEALTH_PATH',
    defaultUrl: 'https://krotic-admin-app-wine.vercel.app',
    defaultPath: '/api/integration/health',
    apiExpected: true,
  },
  almothfin: {
    urlEnv: 'ALMOTHFIN_API_URL',
    pathEnv: 'ALMOTHFIN_HEALTH_PATH',
    defaultUrl: 'https://almothfin-seven.vercel.app',
    defaultPath: '/api/integration/health',
    apiExpected: true,
  },
  'kayan-soft': {
    urlEnv: 'KAYAN_SOFT_API_URL',
    pathEnv: 'KAYAN_SOFT_HEALTH_PATH',
    defaultUrl: 'https://kayan-soft.online',
    defaultPath: '/',
    apiExpected: false,
  },
};

function textEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function configFor(product: EnterpriseProduct): ConnectorConfig | null {
  return CONFIG[product.code as ConnectorCode] ?? null;
}

function mapRemoteStatus(status: unknown): SubscriptionStatus | null {
  if (typeof status !== 'string') return null;
  switch (status.toLowerCase()) {
    case 'active':
    case 'trialing':
    case 'valid':
      return 'active';
    case 'past_due':
    case 'expiring_soon':
      return 'expiring_soon';
    case 'expired':
    case 'cancelled':
    case 'canceled':
      return 'expired';
    case 'suspended':
      return 'suspended';
    default:
      return null;
  }
}

function extractUpdates(body: unknown, subscriptions: SubscriptionRecord[], productId: string) {
  if (!body || typeof body !== 'object') return [];
  const root = body as Record<string, unknown>;
  const raw = Array.isArray(root.subscriptions) ? root.subscriptions : [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const remote = item as Record<string, unknown>;
    const externalId = String(remote.externalAccountId ?? remote.accountId ?? remote.id ?? '');
    const target = subscriptions.find(
      (sub) => sub.productId === productId && externalId && sub.externalAccountId === externalId,
    );
    const status = mapRemoteStatus(remote.status);
    if (!target || !status) return [];
    return [{
      subscriptionId: target.id,
      status,
      planId: String(remote.planId ?? target.planId),
      planName: String(remote.planName ?? target.planName),
      ...(typeof remote.startDate === 'string' ? { startDate: remote.startDate.slice(0, 10) } : {}),
      ...(typeof remote.endDate === 'string' ? { endDate: remote.endDate.slice(0, 10) } : {}),
    }];
  });
}

export async function syncVercelProduct(
  product: EnterpriseProduct,
  subscriptions: SubscriptionRecord[],
): Promise<VercelProductSyncOutcome> {
  const config = configFor(product);
  if (!config) {
    return {
      result: { status: 'warning', connectorHealth: 'degraded', recordsSynced: 0, message: `لا يوجد عقد API مسجل للمنتج ${product.code}.` },
      updates: [],
    };
  }

  const baseUrl = textEnv(config.urlEnv, config.defaultUrl).replace(/\/$/, '');
  const path = textEnv(config.pathEnv, config.defaultPath);
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.CONNECTOR_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json, text/html' },
      signal: controller.signal,
    });
    const bodyText = await response.text();
    let body: unknown = null;
    try { body = bodyText ? JSON.parse(bodyText) : null; } catch { /* public website HTML is valid for non-API connectors */ }

    if (!response.ok) {
      return {
        result: {
          status: 'warning',
          connectorHealth: 'offline',
          recordsSynced: 0,
          message: `فشل فحص ${product.name}: HTTP ${response.status} من ${url}. لم تُعدّل السجلات.`,
        },
        updates: [],
      };
    }

    if (config.apiExpected && !body) {
      return {
        result: { status: 'warning', connectorHealth: 'degraded', recordsSynced: 0, message: `استجاب ${product.name} لكن الرد ليس JSON API صالحاً: ${url}.` },
        updates: [],
      };
    }

    const updates = extractUpdates(body, subscriptions, product.id);
    const isWebsiteOnly = !config.apiExpected;
    return {
      result: {
        status: isWebsiteOnly ? 'warning' : 'success',
        connectorHealth: 'connected',
        recordsSynced: updates.length,
        message: isWebsiteOnly
          ? `تم فحص موقع ${product.name} بنجاح، لكنه لا يقدّم عقد بيانات API للمزامنة.`
          : `تم الاتصال بـ${product.name} عبر API (${url}) ومطابقة ${updates.length} اشتراكاً معروفاً.`,
      },
      updates,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connector error';
    return {
      result: { status: 'failed', connectorHealth: 'offline', recordsSynced: 0, message: `تعذر الاتصال بـ${product.name}: ${message}.` },
      updates: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeVercelProductCommand(product: EnterpriseProduct, command: string, payload: Record<string, unknown> = {}) {
  const config = configFor(product);
  if (!config) return { status: 'warning' as const, message: `لا يوجد موصل Vercel للمنتج ${product.code}.` };
  const secret = process.env.HUB_INTEGRATION_SECRET?.trim();
  if (!secret) return { status: 'failed' as const, message: 'HUB_INTEGRATION_SECRET غير مهيأ في Hub.' };
  const baseUrl = textEnv(config.urlEnv, config.defaultUrl).replace(/\/$/, '');
  const body = JSON.stringify({ command, ...payload, requestedAt: new Date().toISOString() });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const response = await fetch(`${baseUrl}/api/integration/command`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature': signature }, body,
  });
  if (!response.ok) return { status: 'failed' as const, message: `رفض ${product.name} الأمر ${command}: HTTP ${response.status}.` };
  return { status: 'success' as const, message: `قبل ${product.name} الأمر ${command}.` };
}
