import type {
  AuditLogEntry,
  BackupSnapshot,
  CmsArticle,
  CmsPage,
  CmsPageSection,
  CrmLead,
  CrmTask,
  EnterpriseProduct,
  MediaAsset,
  OrgSettings,
  PaymentRecord,
  PlanRecord,
  PortfolioProject,
  SeoRedirect,
  ServiceOffering,
  StaffUser,
  SubscriberIdentity,
  SubscriptionActionType,
  SubscriptionRecord,
  SyncLogEntry,
  UserRole,
  WebsiteSettings,
} from '../shared/types';
import type { CurrencyBreakdown } from '../shared/domain';

export type SafeUser = Omit<StaffUser, 'passwordHash'>;

export interface BootstrapPayload {
  currentUser: SafeUser;
  products: EnterpriseProduct[];
  subscribers: SubscriberIdentity[];
  subscriptions: SubscriptionRecord[];
  plans: PlanRecord[];
  payments: PaymentRecord[];
  paymentSummary: CurrencyBreakdown | null;
  pages: CmsPage[];
  articles: CmsArticle[];
  projects: PortfolioProject[];
  services: ServiceOffering[];
  media: MediaAsset[];
  redirects: SeoRedirect[];
  leads: CrmLead[];
  tasks: CrmTask[];
  users: SafeUser[];
  auditLogs: AuditLogEntry[];
  syncLogs: SyncLogEntry[];
  backupsMeta: BackupSnapshot[];
  websiteSettings: WebsiteSettings;
  orgSettings: OrgSettings;
}

export interface PublicSitePayload {
  websiteSettings: WebsiteSettings;
  pages: CmsPage[];
  articles: CmsArticle[];
  projects: PortfolioProject[];
  services: ServiceOffering[];
  products: EnterpriseProduct[];
  redirects: SeoRedirect[];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `خطأ في الاتصال (${res.status})`);
  }
  return data as T;
}

export const hubApi = {
  getMe: () => request<{ user: SafeUser | null }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: SafeUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  quickRole: (role: UserRole) =>
    request<{ user: SafeUser }>('/api/auth/quick-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  getBootstrap: () => request<BootstrapPayload>('/api/hub/bootstrap'),
  getPublicSite: () => request<PublicSitePayload>('/api/public/site'),

  createProduct: (payload: Partial<EnterpriseProduct>) =>
    request<EnterpriseProduct>('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: string, payload: Partial<EnterpriseProduct>) =>
    request<EnterpriseProduct>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  syncProduct: (id: string) =>
    request<{ product: EnterpriseProduct; syncEntry: SyncLogEntry }>(`/api/products/${id}/sync`, {
      method: 'POST',
    }),

  addSubscriberNote: (subscriberId: string, note: string) =>
    request<SubscriberIdentity>(`/api/subscribers/${subscriberId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  subscriptionAction: (id: string, action: SubscriptionActionType, reason?: string) =>
    request<{ subscription: SubscriptionRecord; message: string; referenceId: string }>(
      `/api/subscriptions/${id}/action`,
      { method: 'POST', body: JSON.stringify({ action, reason }) },
    ),

  createPage: (payload: { name: string; slug: string; title: string; description?: string }) =>
    request<CmsPage>('/api/cms/pages', { method: 'POST', body: JSON.stringify(payload) }),
  savePageDraft: (
    pageId: string,
    payload: {
      name?: string;
      title?: string;
      description?: string;
      seoTitle?: string;
      seoDescription?: string;
      draftSections: CmsPageSection[];
    },
  ) => request<CmsPage>(`/api/cms/pages/${pageId}/draft`, { method: 'PUT', body: JSON.stringify(payload) }),
  publishPage: (pageId: string, summary?: string) =>
    request<CmsPage>(`/api/cms/pages/${pageId}/publish`, { method: 'POST', body: JSON.stringify({ summary }) }),
  restorePageVersion: (pageId: string, versionNumber: number) =>
    request<CmsPage>(`/api/cms/pages/${pageId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ versionNumber }),
    }),

  saveArticle: (payload: Partial<CmsArticle> & { id?: string }) =>
    request<CmsArticle>('/api/cms/articles', { method: 'POST', body: JSON.stringify(payload) }),
  deleteArticle: (id: string) => request<{ deleted: boolean }>(`/api/cms/articles/${id}`, { method: 'DELETE' }),
  saveProject: (payload: Partial<PortfolioProject> & { id?: string }) =>
    request<PortfolioProject>('/api/cms/projects', { method: 'POST', body: JSON.stringify(payload) }),
  saveService: (payload: Partial<ServiceOffering> & { id?: string }) =>
    request<ServiceOffering>('/api/cms/services', { method: 'POST', body: JSON.stringify(payload) }),
  updateWebsiteSettings: (payload: Partial<WebsiteSettings>) =>
    request<WebsiteSettings>('/api/cms/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  addRedirect: (payload: Omit<SeoRedirect, 'id'>) =>
    request<SeoRedirect>('/api/cms/redirects', { method: 'POST', body: JSON.stringify(payload) }),

  addMedia: (payload: {
    fileName: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    category: MediaAsset['category'];
    altText: string;
  }) => request<MediaAsset>('/api/media', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMedia: (id: string) => request<{ deleted: boolean }>(`/api/media/${id}`, { method: 'DELETE' }),

  submitPublicLead: (payload: {
    name: string;
    organization?: string;
    email?: string;
    phone: string;
    country?: string;
    city?: string;
    requestedService: string;
    requestedProject?: string;
    expectedBudget?: string;
    expectedTimeline?: string;
    details: string;
    source?: CrmLead['source'];
    sourcePage?: string;
    idempotencyKey?: string;
  }) => request<CrmLead>('/api/public/leads', { method: 'POST', body: JSON.stringify(payload) }),

  updateLead: (
    id: string,
    payload: {
      stage?: string;
      assigneeId?: string;
      quoteAmount?: string;
      activityType?: 'note' | 'call' | 'meeting' | 'quote';
      activitySummary?: string;
    },
  ) => request<CrmLead>(`/api/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  addTask: (payload: { leadId: string; title: string; dueDate: string }) =>
    request<CrmTask>('/api/crm/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  toggleTask: (id: string) => request<CrmTask>(`/api/crm/tasks/${id}/toggle`, { method: 'POST' }),

  createUser: (payload: { name: string; email: string; role: UserRole; allowedProductIds?: string[]; mfaEnabled?: boolean }) =>
    request<SafeUser>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (
    id: string,
    payload: { role?: UserRole; active?: boolean; mfaEnabled?: boolean; allowedProductIds?: string[] },
  ) => request<SafeUser>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  generateWebhookSample: (productId: string, eventId: string, payload: string) =>
    request<{ productId: string; eventId: string; timestamp: string; signature: string; payload: string }>(
      '/api/integrations/webhook-sample',
      { method: 'POST', body: JSON.stringify({ productId, eventId, payload }) },
    ),
  verifyWebhook: (payload: { productId: string; eventId: string; timestamp: string; signature: string; payload: string }) =>
    request<SyncLogEntry>('/api/integrations/webhook-verify', { method: 'POST', body: JSON.stringify(payload) }),

  createBackup: (reason: string) =>
    request<BackupSnapshot>('/api/backups', { method: 'POST', body: JSON.stringify({ reason }) }),
  restoreBackup: (id: string) =>
    request<{ restored: boolean; backupId: string }>(`/api/backups/${id}/restore`, { method: 'POST' }),
  updateOrgSettings: (payload: Partial<OrgSettings>) =>
    request<OrgSettings>('/api/org/settings', { method: 'PUT', body: JSON.stringify(payload) }),
};
