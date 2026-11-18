import type {
  CmsArticle,
  CmsPage,
  CmsPageSection,
  CrmLead,
  ExchangeRate,
  PaymentRecord,
  Permission,
  PortfolioProject,
  ServiceOffering,
  StaffUser,
  SubscriptionActionType,
  SubscriptionStatus,
  UserRole,
} from './types';

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  owner: 'مالك المؤسسة',
  org_manager: 'مدير المؤسسة',
  product_manager: 'مدير المنتجات',
  subscription_manager: 'مدير الاشتراكات',
  accountant: 'المحاسب',
  site_manager: 'مدير الموقع',
  content_editor: 'محرر المحتوى',
  sales_rep: 'موظف المبيعات',
  viewer: 'مراقب',
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'subscribers.view',
    'subscribers.manage',
    'subscriptions.view',
    'subscriptions.action',
    'plans.view',
    'plans.manage',
    'payments.view',
    'reports.view',
    'reports.export',
    'cms.view',
    'cms.edit',
    'cms.publish',
    'cms.delete',
    'crm.view',
    'crm.manage',
    'media.view',
    'media.manage',
    'users.view',
    'users.manage',
    'audit.view',
    'integrations.view',
    'integrations.manage',
    'backups.manage',
    'settings.view',
    'settings.manage',
  ],
  org_manager: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'subscribers.view',
    'subscribers.manage',
    'subscriptions.view',
    'subscriptions.action',
    'plans.view',
    'plans.manage',
    'payments.view',
    'reports.view',
    'reports.export',
    'cms.view',
    'cms.edit',
    'cms.publish',
    'crm.view',
    'crm.manage',
    'media.view',
    'media.manage',
    'users.view',
    'audit.view',
    'integrations.view',
    'settings.view',
  ],
  product_manager: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'subscribers.view',
    'subscriptions.view',
    'plans.view',
    'plans.manage',
    'reports.view',
    'integrations.view',
    'integrations.manage',
  ],
  subscription_manager: [
    'dashboard.view',
    'products.view',
    'subscribers.view',
    'subscribers.manage',
    'subscriptions.view',
    'subscriptions.action',
    'plans.view',
    'payments.view',
    'reports.view',
  ],
  accountant: [
    'dashboard.view',
    'products.view',
    'subscribers.view',
    'subscriptions.view',
    'plans.view',
    'payments.view',
    'reports.view',
    'reports.export',
  ],
  site_manager: [
    'dashboard.view',
    'cms.view',
    'cms.edit',
    'cms.publish',
    'cms.delete',
    'media.view',
    'media.manage',
    'reports.view',
    'settings.view',
  ],
  content_editor: [
    'dashboard.view',
    'cms.view',
    'cms.edit',
    'media.view',
    'media.manage',
  ],
  sales_rep: [
    'dashboard.view',
    'crm.view',
    'crm.manage',
    'reports.view',
  ],
  viewer: [
    'dashboard.view',
    'products.view',
    'subscribers.view',
    'subscriptions.view',
    'plans.view',
    'payments.view',
    'reports.view',
    'cms.view',
    'crm.view',
    'media.view',
  ],
};

export function hasPermission(user: Pick<StaffUser, 'role' | 'active'>, permission: Permission): boolean {
  if (!user.active) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function canAccessProduct(user: Pick<StaffUser, 'allowedProductIds' | 'active'>, productId: string): boolean {
  if (!user.active) return false;
  if (!user.allowedProductIds || user.allowedProductIds.length === 0) return true;
  return user.allowedProductIds.includes(productId);
}

/**
 * Multi-currency financial aggregation rule (Section 8.8 & 13.2):
 * Never sum different currencies into one number without a documented exchange rate and reference date.
 */
export interface CurrencyBreakdown {
  byCurrency: Record<string, { paidTotal: number; pendingTotal: number; failedTotal: number; count: number }>;
  convertedUsdTotal: number | null;
  missingRateCurrencies: string[];
  referenceDateUsed: string | null;
}

export function aggregatePaymentsSafely(
  payments: PaymentRecord[],
  exchangeRates: ExchangeRate[],
): CurrencyBreakdown {
  const byCurrency: Record<string, { paidTotal: number; pendingTotal: number; failedTotal: number; count: number }> = {};
  const rateMap = new Map<string, ExchangeRate>();
  for (const r of exchangeRates) {
    rateMap.set(r.currency, r);
  }

  for (const p of payments) {
    if (!byCurrency[p.currency]) {
      byCurrency[p.currency] = { paidTotal: 0, pendingTotal: 0, failedTotal: 0, count: 0 };
    }
    byCurrency[p.currency].count += 1;
    if (p.status === 'paid') byCurrency[p.currency].paidTotal += p.amount;
    if (p.status === 'pending') byCurrency[p.currency].pendingTotal += p.amount;
    if (p.status === 'failed') byCurrency[p.currency].failedTotal += p.amount;
  }

  const missingRateCurrencies: string[] = [];
  let convertedSum = 0;
  let referenceDateUsed: string | null = null;

  for (const [currency, summary] of Object.entries(byCurrency)) {
    const rate = rateMap.get(currency);
    if (!rate || rate.rateToUSD <= 0) {
      missingRateCurrencies.push(currency);
    } else {
      convertedSum += summary.paidTotal * rate.rateToUSD;
      if (!referenceDateUsed || rate.referenceDate > referenceDateUsed) {
        referenceDateUsed = rate.referenceDate;
      }
    }
  }

  return {
    byCurrency,
    convertedUsdTotal: missingRateCurrencies.length === 0 ? Math.round(convertedSum * 100) / 100 : null,
    missingRateCurrencies,
    referenceDateUsed,
  };
}

/**
 * Prevents duplicate lead submissions from accidental double-submits (Section 10.5).
 */
export function isDuplicateLead(
  existingLeads: CrmLead[],
  incoming: { email: string; phone: string; requestedService: string },
  nowMs: number,
  windowMinutes = 30,
): boolean {
  const normalizedEmail = incoming.email.trim().toLowerCase();
  const normalizedPhone = incoming.phone.replace(/\s+/g, '');
  const normalizedService = incoming.requestedService.trim();
  const windowMs = windowMinutes * 60 * 1000;

  return existingLeads.some((lead) => {
    const createdMs = Date.parse(lead.createdAt);
    if (Number.isNaN(createdMs) || nowMs - createdMs > windowMs) {
      return false;
    }
    const sameContact =
      (normalizedEmail && lead.email.trim().toLowerCase() === normalizedEmail) ||
      (normalizedPhone && lead.phone.replace(/\s+/g, '') === normalizedPhone);
    return sameContact && lead.requestedService.trim() === normalizedService;
  });
}

/**
 * Section 11: Media deletion guard. A file may only be deleted if no active page, article, or project references its URL.
 */
export function findMediaReferences(
  mediaUrl: string,
  content: {
    pages: CmsPage[];
    articles: CmsArticle[];
    projects: PortfolioProject[];
  },
): string[] {
  const refs: string[] = [];
  for (const page of content.pages) {
    const usedInLive = page.ogImage === mediaUrl || page.sections.some((s) => s.imageUrl === mediaUrl);
    const usedInDraft = page.draftSections.some((s) => s.imageUrl === mediaUrl);
    if (usedInLive || usedInDraft) {
      refs.push(`صفحة: ${page.name}`);
    }
  }
  for (const article of content.articles) {
    if (article.coverImage === mediaUrl || article.content.includes(mediaUrl)) {
      refs.push(`مقال: ${article.title}`);
    }
  }
  for (const project of content.projects) {
    if (project.coverImage === mediaUrl) {
      refs.push(`مشروع: ${project.name}`);
    }
  }
  return refs;
}

/**
 * Section 9.1: Block free-form HTML/JS injection from the visual page editor.
 */
const DANGEROUS_HTML_JS_PATTERNS = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /javascript\s*:/i,
  /\bon(click|load|error|mouseover|focus|input)\s*=/i,
];

export function validateSafeSectionContent(section: Pick<CmsPageSection, 'title' | 'subtitle' | 'body' | 'ctaHref'>): {
  valid: boolean;
  reason?: string;
} {
  const fields = [section.title, section.subtitle ?? '', section.body ?? '', section.ctaHref ?? ''];
  for (const value of fields) {
    for (const pattern of DANGEROUS_HTML_JS_PATTERNS) {
      if (pattern.test(value)) {
        return {
          valid: false,
          reason: 'غير مسموح بإدخال أكواد HTML أو JavaScript حرة داخل المحرر المرئي حفاظاً على أمان الموقع.',
        };
      }
    }
  }
  return { valid: true };
}

/**
 * Validate allowed subscription transitions via Product Connector API.
 */
export function validateSubscriptionAction(
  currentStatus: SubscriptionStatus,
  action: SubscriptionActionType,
): { allowed: boolean; nextStatus?: SubscriptionStatus; reason?: string } {
  if (action === 'renew') {
    if (currentStatus === 'suspended') {
      return { allowed: false, reason: 'لا يمكن تجديد اشتراك موقوف قبل إعادة تفعيله.' };
    }
    return { allowed: true, nextStatus: 'active' };
  }
  if (action === 'suspend') {
    if (currentStatus === 'suspended') {
      return { allowed: false, reason: 'الاشتراك موقوف بالفعل.' };
    }
    return { allowed: true, nextStatus: 'suspended' };
  }
  if (action === 'reactivate') {
    if (currentStatus !== 'suspended' && currentStatus !== 'expired') {
      return { allowed: false, reason: 'إعادة التفعيل متاحة فقط للاشتراكات الموقوفة أو المنتهية.' };
    }
    return { allowed: true, nextStatus: 'active' };
  }
  return { allowed: false, reason: 'إجراء غير معروف.' };
}

/**
 * Section 16: Replay attack guard for incoming webhooks (5-minute drift window).
 */
export function isWebhookTimestampFresh(timestampIsoOrUnix: string | number, nowMs: number, maxDriftMs = 5 * 60 * 1000): boolean {
  const parsed =
    typeof timestampIsoOrUnix === 'number'
      ? timestampIsoOrUnix < 1e12
        ? timestampIsoOrUnix * 1000
        : timestampIsoOrUnix
      : Date.parse(timestampIsoOrUnix);
  if (Number.isNaN(parsed)) return false;
  return Math.abs(nowMs - parsed) <= maxDriftMs;
}
