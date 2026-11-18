import crypto from 'node:crypto';
import type {
  EnterpriseProduct,
  SubscriptionActionType,
  SubscriptionRecord,
  SubscriptionStatus,
} from '../../shared/types';
import { validateSubscriptionAction } from '../../shared/domain';

export interface ConnectorSyncResult {
  status: 'success' | 'warning' | 'failed';
  connectorHealth: 'connected' | 'degraded' | 'offline';
  recordsSynced: number;
  message: string;
}

export interface ConnectorActionResult {
  ok: boolean;
  referenceId?: string;
  nextStatus?: SubscriptionStatus;
  newEndDate?: string;
  message: string;
}

/**
 * Independent Product Connector Layer (Section 15.3).
 * Never touches product databases directly; enforces product-specific boundaries and audit gates.
 */
export function runProductHealthAndSync(
  product: EnterpriseProduct,
  subscriptions: SubscriptionRecord[],
): ConnectorSyncResult {
  const count = subscriptions.filter((s) => s.productId === product.id).length;

  if (!product.serviceActive) {
    return {
      status: 'failed',
      connectorHealth: 'offline',
      recordsSynced: 0,
      message: `تم إيقاف المزامنة مؤقتاً لأن الخدمة (${product.name}) متوقفة إدارياً. لم تتأثر قاعدة بيانات المنتج.`,
    };
  }

  if (product.auditStatus === 'needs_audit') {
    return {
      status: 'warning',
      connectorHealth: 'degraded',
      recordsSynced: count,
      message: `مزامنة للقراءة فقط من (${product.sourceOfTruth}): لا يزال المنتج بانتظار إغلاق التدقيق الأمني لبيئة الإنتاج.`,
    };
  }

  if (product.auditStatus === 'restricted_privacy') {
    return {
      status: 'warning',
      connectorHealth: 'connected',
      recordsSynced: count,
      message: 'تمت مزامنة حالات الترخيص الأساسية فقط؛ بيانات الرواتب والسلف والحضور محجوبة وفق سياسة الخصوصية.',
    };
  }

  return {
    status: 'success',
    connectorHealth: 'connected',
    recordsSynced: count,
    message: `تم التحقق من الاتصال ومزامنة ${count} اشتراكات عبر (${product.sourceOfTruth}).`,
  };
}

export function executeConnectorSubscriptionAction(
  product: EnterpriseProduct,
  subscription: SubscriptionRecord,
  action: SubscriptionActionType,
): ConnectorActionResult {
  if (product.auditStatus === 'needs_audit') {
    return {
      ok: false,
      message: `مرفوض: لا يُسمح بتنفيذ تعديلات حالة الاشتراك على (${product.name}) قبل إغلاق تدقيق مصدر الحقيقة في المرحلة صفر.`,
    };
  }

  if (product.auditStatus === 'restricted_privacy') {
    return {
      ok: false,
      message: `مرفوض: نموذج الاشتراك التجاري لـ (${product.name}) قيد الاعتماد ولم يُفتح للتعديل من المركز.`,
    };
  }

  const check = validateSubscriptionAction(subscription.status, action);
  if (!check.allowed || !check.nextStatus) {
    return {
      ok: false,
      message: check.reason ?? 'العملية غير مسموحة لهذه الحالة.',
    };
  }

  const refPrefix = product.code === 'kayan-ai' ? 'STR-API' : 'KRT-API';
  const referenceId = `${refPrefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  let newEndDate = subscription.endDate;
  if (action === 'renew') {
    const base = new Date(subscription.endDate);
    const now = new Date();
    const startFrom = base > now ? base : now;
    startFrom.setMonth(startFrom.getMonth() + 1);
    newEndDate = startFrom.toISOString().slice(0, 10);
  }

  const actionArabic = action === 'renew' ? 'التجديد' : action === 'suspend' ? 'الإيقاف' : 'إعادة التفعيل';
  return {
    ok: true,
    referenceId,
    nextStatus: check.nextStatus,
    newEndDate,
    message: `تم تنفيذ طلب ${actionArabic} عبر موصل ${product.sourceOfTruth} بنجاح. الرقم المرجعي: ${referenceId}`,
  };
}

export function computeWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookHmac(payload: string, signatureHex: string, secret: string): boolean {
  if (!signatureHex || !/^[0-9a-f]+$/i.test(signatureHex)) return false;
  const expected = computeWebhookSignature(payload, secret);
  const sigBuf = Buffer.from(signatureHex, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
