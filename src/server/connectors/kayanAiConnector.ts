import type { EnterpriseProduct, SubscriptionRecord, SubscriptionStatus } from '../../shared/types.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface KayanAiBillingSnapshot {
  organizationId: string;
  organizationName: string;
  subscription: {
    status: string;
    planCode: string;
    periodStart: string | null;
    periodEnd: string | null;
  };
  usage: Record<string, number>;
}

export interface KayanAiSyncOutcome {
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

function requiredEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function mapStatus(status: string): SubscriptionStatus {
  switch (status.toLowerCase()) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'expiring_soon';
    case 'cancelled':
    case 'canceled':
      return 'expired';
    case 'suspended':
      return 'suspended';
    default:
      return 'pending';
  }
}

async function getBillingSnapshot(baseUrl: string, apiKey: string): Promise<KayanAiBillingSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/billing`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Kayan AI returned invalid JSON (HTTP ${response.status})`);
    }

    if (!response.ok) {
      const errorCode =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error?: unknown }).error)
          : `HTTP ${response.status}`;
      throw new Error(`Kayan AI API rejected the request: ${errorCode}`);
    }

    return body as KayanAiBillingSnapshot;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reads Kayan AI through its public, scoped API-key contract.
 * It never connects to Kayan AI's PostgreSQL database and never sends a billing mutation.
 */
export async function syncKayanAiProduct(
  product: EnterpriseProduct,
  subscriptions: SubscriptionRecord[],
): Promise<KayanAiSyncOutcome> {
  const baseUrl = requiredEnv('KAYAN_AI_API_URL');
  const apiKey = requiredEnv('KAYAN_AI_API_KEY');
  const expectedOrganizationId = requiredEnv('KAYAN_AI_ORGANIZATION_ID');

  if (!baseUrl || !apiKey || !expectedOrganizationId) {
    return {
      result: {
        status: 'warning',
        connectorHealth: 'degraded',
        recordsSynced: 0,
        message:
          'موصل Kayan AI غير مهيأ: اضبط KAYAN_AI_API_URL وKAYAN_AI_API_KEY وKAYAN_AI_ORGANIZATION_ID. لم تُستخدم بيانات محلية كبديل.',
      },
      updates: [],
    };
  }

  try {
    const snapshot = await getBillingSnapshot(baseUrl, apiKey);
    if (snapshot.organizationId !== expectedOrganizationId) {
      return {
        result: {
          status: 'failed',
          connectorHealth: 'offline',
          recordsSynced: 0,
          message: 'رفض الموصل مزامنة الحساب لأن organization_id المستلم لا يطابق الحساب المصرح به.',
        },
        updates: [],
      };
    }

    const matchingSubscriptions = subscriptions.filter(
      (subscription) =>
        subscription.productId === product.id && subscription.externalAccountId === snapshot.organizationId,
    );

    if (matchingSubscriptions.length === 0) {
      return {
        result: {
          status: 'warning',
          connectorHealth: 'connected',
          recordsSynced: 0,
          message: `تم الاتصال بـKayan AI، لكن لا يوجد اشتراك مركزي مرتبط بالمنظمة ${snapshot.organizationId}. لم تُنشأ سجلات تلقائية.`,
        },
        updates: [],
      };
    }

    const nextStatus = mapStatus(snapshot.subscription.status);
    const updates = matchingSubscriptions.map((subscription) => ({
      subscriptionId: subscription.id,
      status: nextStatus,
      planId: snapshot.subscription.planCode,
      planName: snapshot.subscription.planCode,
      ...(snapshot.subscription.periodStart ? { startDate: snapshot.subscription.periodStart.slice(0, 10) } : {}),
      ...(snapshot.subscription.periodEnd ? { endDate: snapshot.subscription.periodEnd.slice(0, 10) } : {}),
    }));

    return {
      result: {
        status: 'success',
        connectorHealth: 'connected',
        recordsSynced: updates.length,
        message: `تمت مزامنة ${updates.length} اشتراكًا من Kayan AI عبر API Key محدود الصلاحية. المصدر: Stripe + Kayan AI.`,
      },
      updates,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Kayan AI connector error';
    return {
      result: {
        status: 'failed',
        connectorHealth: 'offline',
        recordsSynced: 0,
        message: `فشل الاتصال بـKayan AI: ${message}. لم تُعدّل السجلات المحلية.`,
      },
      updates: [],
    };
  }
}
