import crypto from 'node:crypto';
import {
  aggregatePaymentsSafely,
  canAccessProduct,
  findMediaReferences,
  hasPermission,
  isDuplicateLead,
  isWebhookTimestampFresh,
  validateSafeSectionContent,
} from '../../shared/domain.js';
import type {
  AuditLogEntry,
  CmsArticle,
  CmsPage,
  CmsPageSection,
  CrmLead,
  CrmTask,
  EnterpriseProduct,
  HubStateSnapshot,
  LeadSource,
  MediaAsset,
  OrgSettings,
  Permission,
  PortfolioProject,
  SeoRedirect,
  ServiceOffering,
  StaffUser,
  SubscriptionActionType,
  UserRole,
  WebsiteSettings,
} from '../../shared/types.js';
import {
  computeWebhookSignature,
  executeConnectorSubscriptionAction,
  runProductHealthAndSync,
  syncKayanAiProduct,
  syncVercelProduct,
  verifyWebhookHmac,
} from '../connectors/productConnectors.js';
import { hubRepository } from '../repositories/hubRepository.js';
import { hashPassword } from '../repositories/seedData.js';

const SESSION_SECRET = process.env.KAYAN_SESSION_SECRET || 'kayan-soft-hub-dev-hmac-secret-2026';
const WEBHOOK_SECRET = process.env.KAYAN_WEBHOOK_SECRET || 'kayan-webhook-signing-secret-2026';

export type SafeStaffUser = Omit<StaffUser, 'passwordHash'>;

export function sanitizeUser(user: StaffUser): SafeStaffUser {
  const { passwordHash: _removed, ...rest } = user;
  return rest;
}

export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function makeAudit(
  actor: SafeStaffUser | { id: string; name: string; role: UserRole },
  action: string,
  module: string,
  targetId: string,
  targetLabel: string,
  details: string,
  status: 'success' | 'denied' | 'failed' = 'success',
): AuditLogEntry {
  return {
    id: `aud-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    module,
    targetId,
    targetLabel,
    referenceId: `REF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    details,
    status,
  };
}

export function signSessionToken(userId: string): string {
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, issuedAtStr, sig] = parts;
  const payload = `${userId}.${issuedAtStr}`;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  if (!/^[0-9a-f]+$/i.test(sig) || sig.length !== expected.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  if (!valid) return null;
  const ageMs = Date.now() - Number(issuedAtStr);
  if (Number.isNaN(ageMs) || ageMs > 1000 * 60 * 60 * 24 * 7) return null;
  return userId;
}

export class HubService {
  public authenticate(email: string, password: string): { user: SafeStaffUser; token: string } {
    const state = hubRepository.readState();
    const normalizedEmail = email.trim().toLowerCase();
    const user = state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    const incomingHash = hashPassword(password);

    if (!user || user.passwordHash !== incomingHash) {
      hubRepository.updateState((draft) => {
        draft.auditLogs.unshift(
          makeAudit(
            { id: 'anon', name: email || 'مجهول', role: 'viewer' },
            'محاولة تسجيل دخول فاشلة',
            'المصادقة',
            normalizedEmail,
            normalizedEmail,
            'بيانات اعتماد غير صحيحة',
            'failed',
          ),
        );
      });
      throw new ServiceError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }

    if (!user.active) {
      throw new ServiceError(403, 'تم إيقاف هذا الحساب من قبل إدارة المؤسسة.');
    }

    hubRepository.updateState((draft) => {
      const target = draft.users.find((u) => u.id === user.id);
      if (target) {
        target.lastLoginAt = new Date().toISOString();
      }
      draft.auditLogs.unshift(
        makeAudit(sanitizeUser(user), 'تسجيل دخول ناجح', 'المصادقة', user.id, user.name, 'تم فتح جلسة عمل موقعة'),
      );
    });

    return { user: sanitizeUser(user), token: signSessionToken(user.id) };
  }

  public quickSessionForRole(role: UserRole): { user: SafeStaffUser; token: string } {
    const state = hubRepository.readState();
    const user = state.users.find((u) => u.role === role && u.active);
    if (!user) {
      throw new ServiceError(404, 'لا يوجد مستخدم نشط بهذا الدور.');
    }
    hubRepository.updateState((draft) => {
      const target = draft.users.find((u) => u.id === user.id);
      if (target) target.lastLoginAt = new Date().toISOString();
      draft.auditLogs.unshift(
        makeAudit(
          sanitizeUser(user),
          'تبديل جلسة الدور',
          'المصادقة',
          user.id,
          user.name,
          `دخول سريع بصلاحية: ${role}`,
        ),
      );
    });
    return { user: sanitizeUser(user), token: signSessionToken(user.id) };
  }

  public getUserFromToken(token: string | undefined): SafeStaffUser | null {
    const userId = verifySessionToken(token);
    if (!userId) return null;
    const state = hubRepository.readState();
    const user = state.users.find((u) => u.id === userId && u.active);
    return user ? sanitizeUser(user) : null;
  }

  public requirePerm(user: SafeStaffUser | null, perm: Permission): SafeStaffUser {
    if (!user) {
      throw new ServiceError(401, 'يجب تسجيل الدخول للوصول إلى هذا المورد.');
    }
    if (!hasPermission(user, perm)) {
      hubRepository.updateState((draft) => {
        draft.auditLogs.unshift(
          makeAudit(
            user,
            'محاولة وصول غير مصرح بها',
            'الأمان والصلاحيات',
            perm,
            perm,
            `رفض الخادم تنفيذ العملية لعدم توفر صلاحية ${perm}`,
            'denied',
          ),
        );
      });
      throw new ServiceError(403, `ليس لديك صلاحية (${perm}) لتنفيذ هذه العملية.`);
    }
    return user;
  }

  public getBootstrapData(user: SafeStaffUser) {
    const state = hubRepository.readState();
    const allowedProducts = state.products.filter((p) => canAccessProduct(user, p.id));
    const allowedProductIds = new Set(allowedProducts.map((p) => p.id));

    const canSeeFinancials = hasPermission(user, 'payments.view');
    const visiblePayments = canSeeFinancials
      ? state.payments.filter((p) => allowedProductIds.has(p.productId))
      : [];

    const visibleSubscriptions = hasPermission(user, 'subscriptions.view')
      ? state.subscriptions.filter((s) => allowedProductIds.has(s.productId))
      : [];

    const visibleSubscribers = hasPermission(user, 'subscribers.view')
      ? state.subscribers.map((sub) => ({
          ...sub,
          linkedAccounts: sub.linkedAccounts.filter((acc) => allowedProductIds.has(acc.productId)),
        }))
      : [];

    return {
      currentUser: user,
      products: hasPermission(user, 'products.view') ? allowedProducts : [],
      subscribers: visibleSubscribers,
      subscriptions: visibleSubscriptions,
      plans: hasPermission(user, 'plans.view')
        ? state.plans.filter((pl) => allowedProductIds.has(pl.productId))
        : [],
      payments: visiblePayments,
      paymentSummary: canSeeFinancials
        ? aggregatePaymentsSafely(visiblePayments, state.orgSettings.exchangeRates)
        : null,
      pages: hasPermission(user, 'cms.view') ? state.pages : [],
      articles: hasPermission(user, 'cms.view') ? state.articles : [],
      projects: hasPermission(user, 'cms.view') ? state.projects : [],
      services: hasPermission(user, 'cms.view') ? state.services : [],
      media: hasPermission(user, 'media.view') ? state.media : [],
      redirects: hasPermission(user, 'cms.view') ? state.redirects : [],
      leads: hasPermission(user, 'crm.view') ? state.leads : [],
      tasks: hasPermission(user, 'crm.view') ? state.tasks : [],
      users: hasPermission(user, 'users.view') ? state.users.map(sanitizeUser) : [],
      auditLogs: hasPermission(user, 'audit.view') ? state.auditLogs : [],
      syncLogs: hasPermission(user, 'integrations.view') ? state.syncLogs : [],
      backupsMeta: hasPermission(user, 'backups.manage') || hasPermission(user, 'integrations.view')
        ? state.backupsMeta
        : [],
      websiteSettings: state.websiteSettings,
      orgSettings: state.orgSettings,
    };
  }

  public getPublicWebsiteData() {
    const state = hubRepository.readState();
    return {
      websiteSettings: state.websiteSettings,
      pages: state.pages.filter((p) => p.status === 'published'),
      articles: state.articles.filter((a) => a.status === 'published'),
      projects: state.projects
        .filter((p) => p.published)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      services: state.services
        .filter((s) => s.published)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      products: state.products.filter((p) => p.marketingVisible && p.serviceActive),
      redirects: state.redirects.filter((r) => r.active),
    };
  }

  public getSitemapXml(): string {
    const state = hubRepository.readState();
    const base = 'https://kayansoft.sa';
    const urls = [
      ...state.pages.filter((p) => p.status === 'published').map((p) => `${base}${p.slug === '/' ? '' : p.slug}`),
      ...state.projects.filter((p) => p.published).map((p) => `${base}/projects/${p.slug}`),
      ...state.articles.filter((a) => a.status === 'published').map((a) => `${base}/blog/${a.slug}`),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u}</loc></url>`)
      .join('\n')}\n</urlset>`;
  }

  // --- Products & Connectors ---
  public createProduct(user: SafeStaffUser, input: Partial<EnterpriseProduct>) {
    this.requirePerm(user, 'products.manage');
    if (!input.name?.trim() || !input.repository?.trim()) {
      throw new ServiceError(400, 'اسم المنتج ومستودع GitHub مطلوبان.');
    }
    return hubRepository.updateState((draft) => {
      const product: EnterpriseProduct = {
        id: `prod-${Date.now()}`,
        code: input.code || input.name!.trim().toLowerCase().replace(/\s+/g, '-'),
        name: input.name!.trim(),
        description: input.description?.trim() || '',
        repository: input.repository!.trim(),
        defaultBranch: input.defaultBranch?.trim() || 'main',
        techStack: input.techStack?.length ? input.techStack : ['TypeScript', 'REST API'],
        websiteUrl: input.websiteUrl?.trim() || 'https://kayansoft.sa',
        adminUrl: input.adminUrl?.trim() || 'https://admin.kayansoft.sa',
        supportUrl: input.supportUrl?.trim() || 'https://support.kayansoft.sa',
        sourceOfTruth: input.sourceOfTruth?.trim() || 'Product API Contract',
        auditStatus: input.auditStatus || 'needs_audit',
        auditSummary: input.auditSummary?.trim() || 'منتج مضاف حديثاً بانتظار إغلاق فحص المرحلة صفر.',
        connectorHealth: 'connected',
        serviceActive: true,
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'warning',
        allowedSharedFields: input.allowedSharedFields?.length
          ? input.allowedSharedFields
          : ['external_account_id', 'subscription_status'],
        excludedOperationalModules: input.excludedOperationalModules?.length
          ? input.excludedOperationalModules
          : ['العمليات اليومية الداخلية'],
        privacyNotes: input.privacyNotes?.trim() || 'التكامل مقصور على واجهات API المعتمدة.',
        marketingVisible: Boolean(input.marketingVisible),
        marketingTagline: input.marketingTagline?.trim() || input.description?.trim() || '',
      };
      draft.products.push(product);
      draft.auditLogs.unshift(
        makeAudit(user, 'إضافة منتج مؤسسي جديد', 'المنتجات', product.id, product.name, `المستودع: ${product.repository}`),
      );
      return product;
    });
  }

  public updateProduct(user: SafeStaffUser, productId: string, patch: Partial<EnterpriseProduct>) {
    this.requirePerm(user, 'products.manage');
    if (!canAccessProduct(user, productId)) {
      throw new ServiceError(403, 'لا تملك صلاحية الوصول إلى هذا المنتج.');
    }
    return hubRepository.updateState((draft) => {
      const product = draft.products.find((p) => p.id === productId);
      if (!product) throw new ServiceError(404, 'المنتج غير موجود.');
      if (patch.name !== undefined) product.name = patch.name.trim();
      if (patch.description !== undefined) product.description = patch.description;
      if (patch.websiteUrl !== undefined) product.websiteUrl = patch.websiteUrl;
      if (patch.adminUrl !== undefined) product.adminUrl = patch.adminUrl;
      if (patch.supportUrl !== undefined) product.supportUrl = patch.supportUrl;
      if (patch.serviceActive !== undefined) product.serviceActive = patch.serviceActive;
      if (patch.allowedSharedFields !== undefined) product.allowedSharedFields = patch.allowedSharedFields;
      if (patch.marketingVisible !== undefined) product.marketingVisible = patch.marketingVisible;
      if (patch.marketingTagline !== undefined) product.marketingTagline = patch.marketingTagline;
      draft.auditLogs.unshift(
        makeAudit(user, 'تحديث إعدادات منتج', 'المنتجات', product.id, product.name, 'تحديث بيانات الربط والحقول المصرح بها'),
      );
      return product;
    });
  }

  public async syncProduct(user: SafeStaffUser, productId: string, trigger: 'manual' | 'scheduled' = 'manual') {
    this.requirePerm(user, 'integrations.manage');
    if (!canAccessProduct(user, productId)) {
      throw new ServiceError(403, 'لا تملك صلاحية مزامنة هذا المنتج.');
    }

    const current = hubRepository.readState();
    const currentProduct = current.products.find((p) => p.id === productId);
    if (!currentProduct) throw new ServiceError(404, 'المنتج غير موجود.');
    const remoteSync = currentProduct.code === 'kayan-ai'
      ? await syncKayanAiProduct(currentProduct, current.subscriptions)
      : ['krotak-pro', 'krotic-admin', 'almothfin', 'kayan-soft'].includes(currentProduct.code)
        ? await syncVercelProduct(currentProduct, current.subscriptions)
        : null;
    const syncOutcome = remoteSync ?? {
      result: await runProductHealthAndSync(currentProduct, current.subscriptions),
      updates: [],
    };

    return hubRepository.updateState((draft) => {
      const product = draft.products.find((p) => p.id === productId);
      if (!product) throw new ServiceError(404, 'المنتج غير موجود.');
      const res = syncOutcome.result;
      const nowIso = new Date().toISOString();
      product.lastSyncAt = nowIso;
      product.syncStatus = res.status;
      product.connectorHealth = res.connectorHealth;
      if (syncOutcome.updates.length > 0) {
        for (const update of syncOutcome.updates) {
          const subscription = draft.subscriptions.find((item) => item.id === update.subscriptionId);
          if (!subscription) continue;
          subscription.status = update.status;
          subscription.planId = update.planId;
          subscription.planName = update.planName;
          if (update.startDate) subscription.startDate = update.startDate;
          if (update.endDate) subscription.endDate = update.endDate;
          subscription.sourceOfTruth = product.code === 'kayan-ai'
            ? 'Kayan AI API → Stripe + PostgreSQL'
            : `${product.name} API`;
          subscription.lastSyncedAt = nowIso;
        }
      }
      for (const sub of draft.subscriptions) {
        if (sub.productId === product.id && syncOutcome.updates.length === 0) {
          sub.lastSyncedAt = nowIso;
        }
      }
      const syncEntry = {
        id: `syn-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        trigger,
        status: res.status,
        recordsSynced: res.recordsSynced,
        message: res.message,
        timestamp: nowIso,
      };
      draft.syncLogs.unshift(syncEntry);
      draft.auditLogs.unshift(
        makeAudit(user, 'مزامنة موصل منتج', 'التكاملات', product.id, product.name, res.message),
      );
      return { product, syncEntry };
    });
  }

  // --- Subscriptions ---
  public performSubscriptionAction(
    user: SafeStaffUser,
    subscriptionId: string,
    action: SubscriptionActionType,
    reason?: string,
  ) {
    this.requirePerm(user, 'subscriptions.action');
    return hubRepository.updateState((draft) => {
      const sub = draft.subscriptions.find((s) => s.id === subscriptionId);
      if (!sub) throw new ServiceError(404, 'الاشتراك غير موجود.');
      if (!canAccessProduct(user, sub.productId)) {
        throw new ServiceError(403, 'لا تملك صلاحية إدارة اشتراكات هذا المنتج.');
      }
      const product = draft.products.find((p) => p.id === sub.productId);
      if (!product) throw new ServiceError(404, 'المنتج المرتبط غير موجود.');

      const result = executeConnectorSubscriptionAction(product, sub, action);
      if (!result.ok || !result.nextStatus) {
        draft.auditLogs.unshift(
          makeAudit(
            user,
            `طلب إجراء اشتراك (${action})`,
            'الاشتراكات',
            sub.id,
            `${sub.subscriberName} — ${sub.productName}`,
            result.message,
            'failed',
          ),
        );
        throw new ServiceError(409, result.message);
      }

      sub.status = result.nextStatus;
      if (result.newEndDate) sub.endDate = result.newEndDate;
      sub.lastActionRef = result.referenceId;
      sub.lastSyncedAt = new Date().toISOString();

      // Update matching linked account status cleanly
      const subscriber = draft.subscribers.find((sr) => sr.id === sub.subscriberId);
      const linkedAcc = subscriber?.linkedAccounts.find((la) => la.externalAccountId === sub.externalAccountId);
      if (linkedAcc) {
        linkedAcc.accountStatus = result.nextStatus === 'suspended' ? 'suspended' : 'active';
        linkedAcc.licenseStatus = result.nextStatus === 'suspended' ? 'revoked' : 'valid';
        linkedAcc.lastSyncedAt = sub.lastSyncedAt;
      }

      draft.auditLogs.unshift(
        makeAudit(
          user,
          `تنفيذ ${action === 'renew' ? 'تجديد' : action === 'suspend' ? 'إيقاف' : 'إعادة تفعيل'} اشتراك`,
          'الاشتراكات',
          sub.id,
          `${sub.subscriberName} (${sub.externalAccountId})`,
          `${result.message}${reason ? ` · السبب: ${reason}` : ''}`,
        ),
      );
      return { subscription: sub, message: result.message, referenceId: result.referenceId };
    });
  }

  public addSubscriberNote(user: SafeStaffUser, subscriberId: string, note: string) {
    this.requirePerm(user, 'subscribers.manage');
    if (!note.trim()) throw new ServiceError(400, 'نص الملاحظة مطلوب.');
    return hubRepository.updateState((draft) => {
      const sub = draft.subscribers.find((s) => s.id === subscriberId);
      if (!sub) throw new ServiceError(404, 'المشترك غير موجود.');
      sub.notes.unshift(`${new Date().toISOString().slice(0, 10)} (${user.name}): ${note.trim()}`);
      draft.auditLogs.unshift(
        makeAudit(user, 'إضافة ملاحظة لمشترك', 'المشتركين', sub.id, sub.displayName, note.trim()),
      );
      return sub;
    });
  }

  // --- CMS Pages & Visual Editor ---
  public savePageDraft(
    user: SafeStaffUser,
    pageId: string,
    payload: {
      name?: string;
      title?: string;
      description?: string;
      seoTitle?: string;
      seoDescription?: string;
      draftSections: CmsPageSection[];
    },
  ) {
    this.requirePerm(user, 'cms.edit');
    for (const sec of payload.draftSections) {
      const check = validateSafeSectionContent(sec);
      if (!check.valid) {
        throw new ServiceError(400, check.reason!);
      }
    }
    return hubRepository.updateState((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (!page) throw new ServiceError(404, 'الصفحة غير موجودة.');
      if (payload.name !== undefined) page.name = payload.name.trim();
      if (payload.title !== undefined) page.title = payload.title.trim();
      if (payload.description !== undefined) page.description = payload.description.trim();
      if (payload.seoTitle !== undefined) page.seoTitle = payload.seoTitle.trim();
      if (payload.seoDescription !== undefined) page.seoDescription = payload.seoDescription.trim();
      page.draftSections = payload.draftSections;
      page.updatedAt = new Date().toISOString();
      page.updatedBy = user.name;
      draft.auditLogs.unshift(
        makeAudit(user, 'حفظ مسودة صفحة في المحرر المرئي', 'إدارة الموقع', page.id, page.name, `عدد الأقسام: ${page.draftSections.length}`),
      );
      return page;
    });
  }

  public publishPage(user: SafeStaffUser, pageId: string, summary?: string) {
    this.requirePerm(user, 'cms.publish');
    return hubRepository.updateState((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (!page) throw new ServiceError(404, 'الصفحة غير موجودة.');
      for (const sec of page.draftSections) {
        const check = validateSafeSectionContent(sec);
        if (!check.valid) throw new ServiceError(400, check.reason!);
      }
      // Save current published state into version history before overwriting
      const nextVer = (page.versions[0]?.versionNumber ?? 0) + 1;
      page.versions.unshift({
        versionNumber: nextVer,
        savedAt: new Date().toISOString(),
        savedBy: user.name,
        summary: summary?.trim() || `نشر الإصدار رقم ${nextVer}`,
        sections: JSON.parse(JSON.stringify(page.sections)) as CmsPageSection[],
      });
      if (page.versions.length > 15) page.versions.pop();

      page.sections = JSON.parse(JSON.stringify(page.draftSections)) as CmsPageSection[];
      page.status = 'published';
      page.updatedAt = new Date().toISOString();
      page.updatedBy = user.name;
      draft.auditLogs.unshift(
        makeAudit(user, 'نشر صفحة على الموقع الرسمي', 'إدارة الموقع', page.id, page.name, `الإصدار #${nextVer}`),
      );
      return page;
    });
  }

  public restorePageVersion(user: SafeStaffUser, pageId: string, versionNumber: number) {
    this.requirePerm(user, 'cms.publish');
    return hubRepository.updateState((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (!page) throw new ServiceError(404, 'الصفحة غير موجودة.');
      const ver = page.versions.find((v) => v.versionNumber === versionNumber);
      if (!ver) throw new ServiceError(404, 'الإصدار المطلوب غير موجود.');
      page.draftSections = JSON.parse(JSON.stringify(ver.sections)) as CmsPageSection[];
      page.sections = JSON.parse(JSON.stringify(ver.sections)) as CmsPageSection[];
      page.updatedAt = new Date().toISOString();
      page.updatedBy = user.name;
      draft.auditLogs.unshift(
        makeAudit(user, 'استعادة نسخة سابقة للصفحة', 'إدارة الموقع', page.id, page.name, `استعادة الإصدار #${versionNumber}`),
      );
      return page;
    });
  }

  public createPage(user: SafeStaffUser, input: { name: string; slug: string; title: string; description?: string }) {
    this.requirePerm(user, 'cms.edit');
    if (!input.name.trim() || !input.slug.trim()) {
      throw new ServiceError(400, 'اسم الصفحة والرابط Slug مطلوبان.');
    }
    const cleanSlug = input.slug.startsWith('/') ? input.slug.trim() : `/${input.slug.trim()}`;
    return hubRepository.updateState((draft) => {
      if (draft.pages.some((p) => p.slug === cleanSlug)) {
        throw new ServiceError(409, 'يوجد صفحة أخرى بنفس الرابط.');
      }
      const initialSection: CmsPageSection = {
        id: `sec-${Date.now()}`,
        type: 'hero',
        title: input.title?.trim() || input.name.trim(),
        subtitle: 'صفحة مخصصة من منصة كيان سوفت',
        body: input.description?.trim() || 'محتوى تمهيدي قابل للتحرير من المحرر المرئي.',
        visible: true,
        templateVariant: 'minimal',
      };
      const page: CmsPage = {
        id: `page-${Date.now()}`,
        name: input.name.trim(),
        slug: cleanSlug,
        title: input.title?.trim() || input.name.trim(),
        description: input.description?.trim() || '',
        status: 'draft',
        seoTitle: `${input.name.trim()} | كيان سوفت`,
        seoDescription: input.description?.trim() || '',
        ogImage: '/src/assets/images/kayan_hero_studio_1794962896296.jpg',
        canonicalUrl: `https://kayansoft.sa${cleanSlug}`,
        sections: [initialSection],
        draftSections: [initialSection],
        versions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.name,
      };
      draft.pages.push(page);
      draft.auditLogs.unshift(
        makeAudit(user, 'إنشاء صفحة جديدة', 'إدارة الموقع', page.id, page.name, `الرابط: ${page.slug}`),
      );
      return page;
    });
  }

  // --- Articles, Projects, Services ---
  public saveArticle(user: SafeStaffUser, input: Partial<CmsArticle> & { id?: string }) {
    this.requirePerm(user, 'cms.edit');
    if (input.status === 'published' || input.status === 'scheduled') {
      this.requirePerm(user, 'cms.publish');
    }
    if (!input.title?.trim()) throw new ServiceError(400, 'عنوان المقال مطلوب.');
    return hubRepository.updateState((draft) => {
      const nowIso = new Date().toISOString();
      if (input.id) {
        const art = draft.articles.find((a) => a.id === input.id);
        if (!art) throw new ServiceError(404, 'المقال غير موجود.');
        Object.assign(art, {
          title: input.title!.trim(),
          slug: input.slug?.trim() || art.slug,
          excerpt: input.excerpt ?? art.excerpt,
          content: input.content ?? art.content,
          category: input.category ?? art.category,
          tags: input.tags ?? art.tags,
          coverImage: input.coverImage ?? art.coverImage,
          status: input.status ?? art.status,
          scheduledAt: input.scheduledAt,
          publishedAt: input.status === 'published' ? art.publishedAt || nowIso : art.publishedAt,
          seoTitle: input.seoTitle ?? art.seoTitle,
          seoDescription: input.seoDescription ?? art.seoDescription,
          revisionCount: art.revisionCount + 1,
          updatedAt: nowIso,
        });
        draft.auditLogs.unshift(makeAudit(user, 'تعديل مقال', 'المقالات', art.id, art.title, `الحالة: ${art.status}`));
        return art;
      }
      const created: CmsArticle = {
        id: `art-${Date.now()}`,
        title: input.title!.trim(),
        slug: input.slug?.trim() || `article-${Date.now()}`,
        excerpt: input.excerpt || '',
        content: input.content || '',
        category: input.category || 'هندسة البرمجيات',
        tags: input.tags || [],
        authorName: user.name,
        coverImage: input.coverImage || '/src/assets/images/article_architecture_cover_1794962895677.jpg',
        status: input.status || 'draft',
        scheduledAt: input.scheduledAt,
        publishedAt: input.status === 'published' ? nowIso : undefined,
        seoTitle: input.seoTitle || input.title!.trim(),
        seoDescription: input.seoDescription || input.excerpt || '',
        views: 0,
        revisionCount: 1,
        updatedAt: nowIso,
      };
      draft.articles.unshift(created);
      draft.auditLogs.unshift(makeAudit(user, 'إنشاء مقال جديد', 'المقالات', created.id, created.title, `الحالة: ${created.status}`));
      return created;
    });
  }

  public deleteArticle(user: SafeStaffUser, articleId: string) {
    this.requirePerm(user, 'cms.delete');
    return hubRepository.updateState((draft) => {
      const idx = draft.articles.findIndex((a) => a.id === articleId);
      if (idx === -1) throw new ServiceError(404, 'المقال غير موجود.');
      const [removed] = draft.articles.splice(idx, 1);
      draft.auditLogs.unshift(makeAudit(user, 'حذف مقال', 'المقالات', removed.id, removed.title, 'تم الحذف نهائياً'));
      return { deleted: true };
    });
  }

  public saveProject(user: SafeStaffUser, input: Partial<PortfolioProject> & { id?: string }) {
    this.requirePerm(user, 'cms.edit');
    if (input.published) {
      this.requirePerm(user, 'cms.publish');
    }
    if (!input.name?.trim()) throw new ServiceError(400, 'اسم المشروع مطلوب.');
    return hubRepository.updateState((draft) => {
      if (input.id) {
        const prj = draft.projects.find((p) => p.id === input.id);
        if (!prj) throw new ServiceError(404, 'المشروع غير موجود.');
        Object.assign(prj, input, { name: input.name!.trim() });
        draft.auditLogs.unshift(makeAudit(user, 'تحديث مشروع في المعرض', 'معرض الأعمال', prj.id, prj.name, `منشور: ${prj.published}`));
        return prj;
      }
      const created: PortfolioProject = {
        id: `prj-${Date.now()}`,
        name: input.name!.trim(),
        slug: input.slug?.trim() || `project-${Date.now()}`,
        category: input.category || 'الأنظمة السحابية',
        year: input.year || '2026',
        shortDescription: input.shortDescription || '',
        detailedDescription: input.detailedDescription || '',
        problemSolved: input.problemSolved || '',
        solutionProvided: input.solutionProvided || '',
        technologies: input.technologies || ['TypeScript', 'React'],
        linkedServices: input.linkedServices || [],
        coverImage: input.coverImage || '/src/assets/images/project_krotak_showcase_1794962892852.jpg',
        projectUrl: input.projectUrl,
        demoUrl: input.demoUrl,
        clientName: input.clientName || 'عميل مؤسسة كيان سوفت',
        showClientName: input.showClientName ?? true,
        featured: input.featured ?? false,
        displayOrder: input.displayOrder ?? draft.projects.length + 1,
        published: input.published ?? false,
        seoTitle: input.seoTitle || input.name!.trim(),
        seoDescription: input.seoDescription || input.shortDescription || '',
      };
      draft.projects.push(created);
      draft.auditLogs.unshift(makeAudit(user, 'إضافة مشروع إلى معرض الأعمال', 'معرض الأعمال', created.id, created.name, `التصنيف: ${created.category}`));
      return created;
    });
  }

  public saveService(user: SafeStaffUser, input: Partial<ServiceOffering> & { id?: string }) {
    this.requirePerm(user, 'cms.edit');
    if (!input.name?.trim()) throw new ServiceError(400, 'اسم الخدمة مطلوب.');
    return hubRepository.updateState((draft) => {
      if (input.id) {
        const srv = draft.services.find((s) => s.id === input.id);
        if (!srv) throw new ServiceError(404, 'الخدمة غير موجودة.');
        Object.assign(srv, input, { name: input.name!.trim() });
        draft.auditLogs.unshift(makeAudit(user, 'تحديث خدمة بالموقع', 'الخدمات', srv.id, srv.name, 'تعديل تفاصيل الخدمة'));
        return srv;
      }
      const created: ServiceOffering = {
        id: `srv-${Date.now()}`,
        name: input.name!.trim(),
        shortDescription: input.shortDescription || '',
        details: input.details || '',
        features: input.features || [],
        startingPrice: input.startingPrice,
        displayOrder: input.displayOrder ?? draft.services.length + 1,
        published: input.published ?? true,
        linkedFormTag: input.linkedFormTag || input.name!.trim(),
      };
      draft.services.push(created);
      draft.auditLogs.unshift(makeAudit(user, 'إضافة خدمة جديدة', 'الخدمات', created.id, created.name, 'تمت إضافتها لقائمة خدمات الموقع'));
      return created;
    });
  }

  // --- Media Library ---
  public addMediaAsset(
    user: SafeStaffUser,
    input: { fileName: string; url: string; mimeType: string; sizeBytes: number; category: MediaAsset['category']; altText: string },
  ) {
    this.requirePerm(user, 'media.manage');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(input.mimeType)) {
      throw new ServiceError(400, 'نوع الملف غير مسموح به. الأنواع المسموحة: JPG, PNG, WebP, PDF.');
    }
    if (input.sizeBytes > 10 * 1024 * 1024) {
      throw new ServiceError(400, 'حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).');
    }
    if (!input.fileName.trim() || !input.url.trim()) {
      throw new ServiceError(400, 'اسم الملف والرابط مطلوبان.');
    }
    return hubRepository.updateState((draft) => {
      const asset: MediaAsset = {
        id: `med-${Date.now()}`,
        fileName: input.fileName.trim(),
        url: input.url.trim(),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        category: input.category,
        altText: input.altText.trim() || input.fileName.trim(),
        uploadedBy: user.name,
        uploadedAt: new Date().toISOString(),
      };
      draft.media.unshift(asset);
      draft.auditLogs.unshift(makeAudit(user, 'رفع ملف وسائط جديد', 'مكتبة الوسائط', asset.id, asset.fileName, asset.mimeType));
      return asset;
    });
  }

  public deleteMediaAsset(user: SafeStaffUser, mediaId: string) {
    this.requirePerm(user, 'media.manage');
    return hubRepository.updateState((draft) => {
      const idx = draft.media.findIndex((m) => m.id === mediaId);
      if (idx === -1) throw new ServiceError(404, 'الملف غير موجود.');
      const asset = draft.media[idx];
      const refs = findMediaReferences(asset.url, {
        pages: draft.pages,
        articles: draft.articles,
        projects: draft.projects,
      });
      if (refs.length > 0) {
        throw new ServiceError(409, `لا يمكن حذف الملف لأنه مستخدم حالياً في: ${refs.join('، ')}`);
      }
      draft.media.splice(idx, 1);
      draft.auditLogs.unshift(makeAudit(user, 'حذف ملف وسائط', 'مكتبة الوسائط', asset.id, asset.fileName, 'تم التحقق من عدم وجود مراجع'));
      return { deleted: true };
    });
  }

  // --- SEO & Website Settings ---
  public updateWebsiteSettings(user: SafeStaffUser, patch: Partial<WebsiteSettings>) {
    this.requirePerm(user, 'cms.publish');
    return hubRepository.updateState((draft) => {
      draft.websiteSettings = { ...draft.websiteSettings, ...patch };
      draft.auditLogs.unshift(makeAudit(user, 'تحديث إعدادات الموقع والهوية', 'إدارة الموقع', 'site-settings', 'إعدادات الموقع', 'تم تطبيق التعديلات'));
      return draft.websiteSettings;
    });
  }

  public addRedirect(user: SafeStaffUser, input: Omit<SeoRedirect, 'id'>) {
    this.requirePerm(user, 'cms.publish');
    if (!input.fromPath.startsWith('/') || !input.toPath.startsWith('/')) {
      throw new ServiceError(400, 'يجب أن تبدأ المسارات بالرمز /');
    }
    return hubRepository.updateState((draft) => {
      const red: SeoRedirect = { ...input, id: `red-${Date.now()}` };
      draft.redirects.push(red);
      draft.auditLogs.unshift(makeAudit(user, 'إضافة تحويل رابط SEO', 'SEO', red.id, `${red.fromPath} -> ${red.toPath}`, `رمز ${red.statusCode}`));
      return red;
    });
  }

  // --- CRM Leads & Tasks ---
  public submitPublicLead(input: {
    name: string;
    organization?: string;
    email: string;
    phone: string;
    country?: string;
    city?: string;
    requestedService: string;
    requestedProject?: string;
    expectedBudget?: string;
    expectedTimeline?: string;
    details: string;
    source?: LeadSource;
    simulateWhatsappFailure?: boolean;
  }) {
    if (!input.name?.trim() || !input.email?.trim() || !input.phone?.trim() || !input.details?.trim()) {
      throw new ServiceError(400, 'الاسم والبريد الإلكتروني ورقم الهاتف وتفاصيل الطلب حقول إلزامية.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw new ServiceError(400, 'صيغة البريد الإلكتروني غير صالحة.');
    }

    return hubRepository.updateState((draft) => {
      const nowMs = Date.now();
      if (
        isDuplicateLead(
          draft.leads,
          { email: input.email, phone: input.phone, requestedService: input.requestedService },
          nowMs,
        )
      ) {
        throw new ServiceError(409, 'تم استلام طلب مطابق منكم قبل قليل. تم منع التكرار وحفظ الطلب الأصلي.');
      }

      const defaultSales = draft.users.find((u) => u.role === 'sales_rep' && u.active) || draft.users[0];
      const nowIso = new Date(nowMs).toISOString();
      const whatsappStatus = input.simulateWhatsappFailure ? 'failed' : 'sent';

      const lead: CrmLead = {
        id: `lead-${nowMs}`,
        name: input.name.trim(),
        organization: input.organization?.trim() || 'غير محدد',
        email: input.email.trim(),
        phone: input.phone.trim(),
        country: input.country?.trim() || 'السعودية',
        city: input.city?.trim() || 'غير محدد',
        requestedService: input.requestedService.trim(),
        requestedProject: input.requestedProject?.trim() || input.requestedService.trim(),
        expectedBudget: input.expectedBudget?.trim() || 'يحدد بعد الدراسة',
        expectedTimeline: input.expectedTimeline?.trim() || 'مرن',
        details: input.details.trim(),
        source: input.source || 'project_request_form',
        stage: draft.orgSettings.crmStages[0] || 'جديد',
        assigneeId: defaultSales.id,
        assigneeName: defaultSales.name,
        whatsappNotificationStatus: whatsappStatus,
        createdAt: nowIso,
        updatedAt: nowIso,
        activities: [
          {
            id: `act-${nowMs}`,
            type: 'notification_log',
            author: 'نظام استقبال الطلبات',
            summary:
              whatsappStatus === 'failed'
                ? 'تم حفظ الطلب في قاعدة البيانات الدائمة؛ تعذر إرسال تنبيه واتساب وسُجل الإخفاق دون فقدان البيانات.'
                : 'تم حفظ الطلب في قاعدة البيانات الدائمة وإرسال تنبيه للمسؤول.',
            createdAt: nowIso,
          },
        ],
      };

      draft.leads.unshift(lead);
      draft.auditLogs.unshift(
        makeAudit(
          { id: 'public-form', name: lead.name, role: 'viewer' },
          'استقبال طلب عميل جديد',
          'العملاء وCRM',
          lead.id,
          `${lead.name} — ${lead.organization}`,
          `المصدر: ${lead.source} · حالة إشعار واتساب: ${whatsappStatus}`,
        ),
      );
      return lead;
    });
  }

  public updateLead(
    user: SafeStaffUser,
    leadId: string,
    patch: {
      stage?: string;
      assigneeId?: string;
      quoteAmount?: string;
      activityType?: 'note' | 'call' | 'meeting' | 'quote';
      activitySummary?: string;
    },
  ) {
    this.requirePerm(user, 'crm.manage');
    return hubRepository.updateState((draft) => {
      const lead = draft.leads.find((l) => l.id === leadId);
      if (!lead) throw new ServiceError(404, 'العميل غير موجود.');
      const nowIso = new Date().toISOString();

      if (patch.stage && patch.stage !== lead.stage) {
        const oldStage = lead.stage;
        lead.stage = patch.stage;
        lead.activities.unshift({
          id: `act-${Date.now()}-st`,
          type: 'stage_change',
          author: user.name,
          summary: `نقل المرحلة من "${oldStage}" إلى "${patch.stage}"`,
          createdAt: nowIso,
        });
      }

      if (patch.assigneeId && patch.assigneeId !== lead.assigneeId) {
        const staff = draft.users.find((u) => u.id === patch.assigneeId);
        if (staff) {
          lead.assigneeId = staff.id;
          lead.assigneeName = staff.name;
          lead.activities.unshift({
            id: `act-${Date.now()}-as`,
            type: 'note',
            author: user.name,
            summary: `إسناد المتابعة إلى: ${staff.name}`,
            createdAt: nowIso,
          });
        }
      }

      if (patch.quoteAmount !== undefined) {
        lead.quoteAmount = patch.quoteAmount;
      }

      if (patch.activitySummary?.trim()) {
        lead.activities.unshift({
          id: `act-${Date.now()}-nt`,
          type: patch.activityType || 'note',
          author: user.name,
          summary: patch.activitySummary.trim(),
          createdAt: nowIso,
        });
      }

      lead.updatedAt = nowIso;
      draft.auditLogs.unshift(
        makeAudit(user, 'تحديث ملف عميل CRM', 'العملاء وCRM', lead.id, lead.name, `المرحلة الحالية: ${lead.stage}`),
      );
      return lead;
    });
  }

  public addCrmTask(user: SafeStaffUser, input: { leadId: string; title: string; dueDate: string }) {
    this.requirePerm(user, 'crm.manage');
    if (!input.title.trim()) throw new ServiceError(400, 'عنوان المهمة مطلوب.');
    return hubRepository.updateState((draft) => {
      const lead = draft.leads.find((l) => l.id === input.leadId);
      if (!lead) throw new ServiceError(404, 'العميل غير موجود.');
      const task: CrmTask = {
        id: `tsk-${Date.now()}`,
        leadId: lead.id,
        leadName: `${lead.name} — ${lead.organization}`,
        title: input.title.trim(),
        assigneeName: lead.assigneeName || user.name,
        dueDate: input.dueDate || new Date().toISOString().slice(0, 10),
        completed: false,
      };
      draft.tasks.unshift(task);
      lead.activities.unshift({
        id: `act-${Date.now()}-tsk`,
        type: 'task_created',
        author: user.name,
        summary: `جدولة مهمة متابعة: ${task.title} (الاستحقاق: ${task.dueDate})`,
        createdAt: new Date().toISOString(),
      });
      return task;
    });
  }

  public toggleCrmTask(user: SafeStaffUser, taskId: string) {
    this.requirePerm(user, 'crm.manage');
    return hubRepository.updateState((draft) => {
      const task = draft.tasks.find((t) => t.id === taskId);
      if (!task) throw new ServiceError(404, 'المهمة غير موجودة.');
      task.completed = !task.completed;
      return task;
    });
  }

  // --- Users & RBAC ---
  public createUser(
    user: SafeStaffUser,
    input: { name: string; email: string; role: UserRole; allowedProductIds?: string[]; mfaEnabled?: boolean },
  ) {
    this.requirePerm(user, 'users.manage');
    if (!input.name.trim() || !input.email.trim()) {
      throw new ServiceError(400, 'الاسم والبريد الإلكتروني مطلوبان.');
    }
    return hubRepository.updateState((draft) => {
      if (draft.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) {
        throw new ServiceError(409, 'البريد الإلكتروني مسجل مسبقاً.');
      }
      const created: StaffUser = {
        id: `u-${Date.now()}`,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        active: true,
        mfaEnabled: Boolean(input.mfaEnabled),
        allowedProductIds: input.allowedProductIds || [],
        lastLoginAt: new Date().toISOString(),
        passwordHash: hashPassword('Kayan@2026'),
      };
      draft.users.push(created);
      draft.auditLogs.unshift(
        makeAudit(user, 'إضافة مستخدم جديد', 'المستخدمون والصلاحيات', created.id, created.name, `الدور: ${created.role}`),
      );
      return sanitizeUser(created);
    });
  }

  public updateUser(
    user: SafeStaffUser,
    targetUserId: string,
    patch: { role?: UserRole; active?: boolean; mfaEnabled?: boolean; allowedProductIds?: string[] },
  ) {
    this.requirePerm(user, 'users.manage');
    return hubRepository.updateState((draft) => {
      const target = draft.users.find((u) => u.id === targetUserId);
      if (!target) throw new ServiceError(404, 'المستخدم غير موجود.');
      if (target.role === 'owner' && patch.active === false) {
        throw new ServiceError(400, 'لا يمكن إيقاف حساب مالك المؤسسة الأساسي.');
      }
      if (patch.role !== undefined) target.role = patch.role;
      if (patch.active !== undefined) target.active = patch.active;
      if (patch.mfaEnabled !== undefined) target.mfaEnabled = patch.mfaEnabled;
      if (patch.allowedProductIds !== undefined) target.allowedProductIds = patch.allowedProductIds;
      draft.auditLogs.unshift(
        makeAudit(
          user,
          'تعديل صلاحيات أو حالة موظف',
          'المستخدمون والصلاحيات',
          target.id,
          target.name,
          `الدور: ${target.role} · نشط: ${target.active}`,
        ),
      );
      return sanitizeUser(target);
    });
  }

  // --- Webhooks & Backups & Org Settings ---
  public processSignedWebhook(input: {
    productId: string;
    eventId: string;
    timestamp: string;
    signature: string;
    payload: string;
  }) {
    if (!isWebhookTimestampFresh(input.timestamp, Date.now())) {
      throw new ServiceError(401, 'انتهت صلاحية الطابع الزمني للـ Webhook (حماية Replay Attack).');
    }
    const signedBody = `${input.timestamp}.${input.eventId}.${input.payload}`;
    if (!verifyWebhookHmac(signedBody, input.signature, WEBHOOK_SECRET)) {
      throw new ServiceError(401, 'توقيع Webhook غير صالح.');
    }
    return hubRepository.updateState((draft) => {
      if (draft.processedWebhookNonces.includes(input.eventId)) {
        throw new ServiceError(409, 'تمت معالجة هذا الحدث مسبقاً (Idempotency Guard).');
      }
      draft.processedWebhookNonces.unshift(input.eventId);
      if (draft.processedWebhookNonces.length > 200) draft.processedWebhookNonces.pop();

      const product = draft.products.find((p) => p.id === input.productId);
      const syncEntry = {
        id: `syn-wh-${Date.now()}`,
        productId: input.productId,
        productName: product?.name || input.productId,
        trigger: 'webhook' as const,
        status: 'success' as const,
        recordsSynced: 1,
        message: `تم استقبال والتحقق من حدث Webhook موثوق (${input.eventId}).`,
        timestamp: new Date().toISOString(),
      };
      draft.syncLogs.unshift(syncEntry);
      draft.auditLogs.unshift(
        makeAudit(
          { id: 'webhook', name: `Webhook (${product?.name || input.productId})`, role: 'owner' },
          'استقبال حدث Webhook موثوق',
          'التكاملات',
          input.eventId,
          product?.name || input.productId,
          'تم التحقق من التوقيع HMAC والطابع الزمني ومنع التكرار',
        ),
      );
      return syncEntry;
    });
  }

  public generateSampleWebhookHeaders(productId: string, eventId: string, payload: string) {
    const timestamp = new Date().toISOString();
    const signedBody = `${timestamp}.${eventId}.${payload}`;
    const signature = computeWebhookSignature(signedBody, WEBHOOK_SECRET);
    return { productId, eventId, timestamp, signature, payload };
  }

  public createBackup(user: SafeStaffUser, reason: string) {
    this.requirePerm(user, 'backups.manage');
    const state = hubRepository.readState();
    const meta = hubRepository.createBackupFile(state, user.name, reason?.trim() || 'نسخة احتياطية يدوية');
    hubRepository.updateState((draft) => {
      draft.backupsMeta.unshift(meta);
      draft.auditLogs.unshift(
        makeAudit(user, 'إنشاء نسخة احتياطية', 'النسخ الاحتياطي', meta.id, meta.id, `${meta.reason} · ${meta.checksum}`),
      );
    });
    return meta;
  }

  public downloadBackup(user: SafeStaffUser, backupId: string): HubStateSnapshot {
    this.requirePerm(user, 'backups.manage');
    const payload = hubRepository.readBackupPayload(backupId);
    if (!payload) throw new ServiceError(404, 'ملف النسخة الاحتياطية غير موجود.');
    hubRepository.updateState((draft) => {
      draft.auditLogs.unshift(
        makeAudit(user, 'تنزيل نسخة احتياطية', 'النسخ الاحتياطي', backupId, backupId, 'تم تصدير النسخة للمخول'),
      );
    });
    return payload;
  }

  public restoreBackup(user: SafeStaffUser, backupId: string) {
    this.requirePerm(user, 'backups.manage');
    const snapshot = hubRepository.readBackupPayload(backupId);
    if (!snapshot) throw new ServiceError(404, 'النسخة الاحتياطية المطلوبة غير موجودة.');
    // Preserve backup catalog + record who restored
    const current = hubRepository.readState();
    snapshot.backupsMeta = current.backupsMeta;
    snapshot.auditLogs = [
      makeAudit(user, 'استعادة نسخة احتياطية', 'النسخ الاحتياطي', backupId, backupId, 'تمت استعادة بيانات المنصة المركزية بنجاح'),
      ...snapshot.auditLogs,
    ];
    hubRepository.writeState(snapshot);
    return { restored: true, backupId };
  }

  public updateOrgSettings(user: SafeStaffUser, patch: Partial<OrgSettings>) {
    this.requirePerm(user, 'settings.manage');
    return hubRepository.updateState((draft) => {
      draft.orgSettings = { ...draft.orgSettings, ...patch };
      draft.auditLogs.unshift(
        makeAudit(user, 'تحديث إعدادات المؤسسة', 'إعدادات المؤسسة', 'org-settings', 'الإعدادات العامة', 'تعديل السياسات أو المراحل أو أسعار الصرف'),
      );
      return draft.orgSettings;
    });
  }
}

export const hubService = new HubService();
