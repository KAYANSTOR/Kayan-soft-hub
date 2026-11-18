export type UserRole =
  | 'owner'
  | 'org_manager'
  | 'product_manager'
  | 'subscription_manager'
  | 'accountant'
  | 'site_manager'
  | 'content_editor'
  | 'sales_rep'
  | 'viewer';

export type Permission =
  | 'dashboard.view'
  | 'products.view'
  | 'products.manage'
  | 'subscribers.view'
  | 'subscribers.manage'
  | 'subscriptions.view'
  | 'subscriptions.action'
  | 'plans.view'
  | 'plans.manage'
  | 'payments.view'
  | 'reports.view'
  | 'reports.export'
  | 'cms.view'
  | 'cms.edit'
  | 'cms.publish'
  | 'cms.delete'
  | 'crm.view'
  | 'crm.manage'
  | 'media.view'
  | 'media.manage'
  | 'users.view'
  | 'users.manage'
  | 'audit.view'
  | 'integrations.view'
  | 'integrations.manage'
  | 'backups.manage'
  | 'settings.view'
  | 'settings.manage';

export type AuditReadinessStatus = 'ready' | 'needs_audit' | 'restricted_privacy';

export type ConnectorHealth = 'connected' | 'degraded' | 'offline';

export interface EnterpriseProduct {
  id: string;
  code: 'krotak-pro' | 'krotic-admin' | 'qatshe' | 'kayan-ai' | 'almothfin' | string;
  name: string;
  description: string;
  repository: string;
  defaultBranch: string;
  techStack: string[];
  websiteUrl: string;
  adminUrl: string;
  supportUrl: string;
  sourceOfTruth: string;
  auditStatus: AuditReadinessStatus;
  auditSummary: string;
  connectorHealth: ConnectorHealth;
  serviceActive: boolean;
  lastSyncAt: string;
  syncStatus: 'success' | 'warning' | 'failed';
  allowedSharedFields: string[];
  excludedOperationalModules: string[];
  privacyNotes: string;
  marketingVisible: boolean;
  marketingTagline: string;
}

export interface ExternalAccountLink {
  id: string;
  productId: string;
  productName: string;
  externalAccountId: string;
  externalTenantCode?: string;
  accountDisplayName: string;
  accountStatus: 'active' | 'suspended' | 'expired' | 'pending_audit';
  licenseStatus: 'valid' | 'expiring_soon' | 'revoked' | 'unlicensed';
  deviceStatus?: string;
  sourceOfTruth: string;
  lastSyncedAt: string;
}

export interface SubscriberIdentity {
  id: string;
  displayName: string;
  organizationName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  notes: string[];
  createdAt: string;
  linkedAccounts: ExternalAccountLink[];
}

export type SubscriptionStatus = 'active' | 'expiring_soon' | 'expired' | 'suspended' | 'pending';

export type SubscriptionActionType = 'renew' | 'suspend' | 'reactivate';

export interface SubscriptionRecord {
  id: string;
  subscriberId: string;
  subscriberName: string;
  productId: string;
  productName: string;
  externalAccountId: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  sourceOfTruth: string;
  lastActionRef?: string;
  lastSyncedAt: string;
}

export interface PlanRecord {
  id: string;
  productId: string;
  productName: string;
  name: string;
  targetAudience: string;
  price: number;
  currency: 'USD' | 'SAR' | 'YER';
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  usageLimits: string;
  features: string[];
  status: 'active' | 'archived';
  displayOrder: number;
  sourceSynced: boolean;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  referenceId: string;
  subscriberId: string;
  subscriberName: string;
  productId: string;
  productName: string;
  amount: number;
  currency: 'USD' | 'SAR' | 'YER';
  paidAt: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  dataSource: string;
}

export interface ExchangeRate {
  currency: 'USD' | 'SAR' | 'YER';
  rateToUSD: number;
  referenceDate: string;
  source: string;
}

export type CmsSectionType =
  | 'hero'
  | 'services_grid'
  | 'portfolio_showcase'
  | 'stats'
  | 'testimonials'
  | 'faq'
  | 'cta'
  | 'contact_form'
  | 'rich_text';

export interface CmsPageSection {
  id: string;
  type: CmsSectionType;
  title: string;
  subtitle?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  visible: boolean;
  templateVariant: 'minimal' | 'split' | 'editorial';
  items?: Array<{ label: string; value: string; description?: string }>;
}

export interface CmsPageVersion {
  versionNumber: number;
  savedAt: string;
  savedBy: string;
  summary: string;
  sections: CmsPageSection[];
}

export interface CmsPage {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  status: 'draft' | 'in_review' | 'published';
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  canonicalUrl: string;
  sections: CmsPageSection[];
  draftSections: CmsPageSection[];
  versions: CmsPageVersion[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type ArticleStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

export interface CmsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  authorName: string;
  coverImage: string;
  status: ArticleStatus;
  scheduledAt?: string;
  publishedAt?: string;
  seoTitle: string;
  seoDescription: string;
  views: number;
  revisionCount: number;
  updatedAt: string;
}

export interface PortfolioProject {
  id: string;
  name: string;
  slug: string;
  category: string;
  year: string;
  shortDescription: string;
  detailedDescription: string;
  problemSolved: string;
  solutionProvided: string;
  technologies: string[];
  linkedServices: string[];
  coverImage: string;
  projectUrl?: string;
  demoUrl?: string;
  clientName: string;
  showClientName: boolean;
  featured: boolean;
  displayOrder: number;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
}

export interface ServiceOffering {
  id: string;
  name: string;
  shortDescription: string;
  details: string;
  features: string[];
  startingPrice?: string;
  displayOrder: number;
  published: boolean;
  linkedFormTag: string;
}

export interface MediaAsset {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  category: 'hero' | 'projects' | 'articles' | 'services' | 'documents';
  altText: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface SeoRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302;
  active: boolean;
}

export type LeadSource =
  | 'project_request_form'
  | 'contact_form'
  | 'consultation_request'
  | 'service_request'
  | 'product_trial'
  | 'manual'
  | 'external_api';

export interface LeadActivity {
  id: string;
  type: 'note' | 'call' | 'meeting' | 'quote' | 'stage_change' | 'task_created' | 'notification_log';
  author: string;
  summary: string;
  createdAt: string;
}

export interface CrmTask {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  assigneeName: string;
  dueDate: string;
  completed: boolean;
}

export interface CrmLead {
  id: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  requestedService: string;
  requestedProject: string;
  expectedBudget: string;
  expectedTimeline: string;
  details: string;
  source: LeadSource;
  stage: string;
  assigneeId: string;
  assigneeName: string;
  quoteAmount?: string;
  whatsappNotificationStatus: 'sent' | 'failed' | 'not_configured';
  createdAt: string;
  updatedAt: string;
  activities: LeadActivity[];
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  mfaEnabled: boolean;
  allowedProductIds: string[]; // empty means all products
  lastLoginAt: string;
  passwordHash?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module: string;
  targetId: string;
  targetLabel: string;
  referenceId: string;
  details: string;
  status: 'success' | 'denied' | 'failed';
}

export interface SyncLogEntry {
  id: string;
  productId: string;
  productName: string;
  trigger: 'scheduled' | 'manual' | 'webhook';
  status: 'success' | 'warning' | 'failed';
  recordsSynced: number;
  message: string;
  timestamp: string;
}

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  createdBy: string;
  reason: string;
  sizeBytes: number;
  checksum: string;
}

export interface WebsiteSettings {
  orgName: string;
  tagline: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  socialLinks: {
    github: string;
    linkedin: string;
    x: string;
  };
  announcementBanner: string;
  announcementEnabled: boolean;
  primaryNavigation: Array<{ label: string; slug: string }>;
  footerLegalNote: string;
  robotsTxt: string;
}

export interface OrgSettings {
  companyName: string;
  legalEntity: string;
  defaultCurrency: 'USD' | 'SAR' | 'YER';
  retentionDaysAudit: number;
  retentionDaysBackups: number;
  mfaRequiredForSensitiveRoles: boolean;
  requirePreviewBeforePublish: boolean;
  crmStages: string[];
  exchangeRates: ExchangeRate[];
}

export interface HubStateSnapshot {
  products: EnterpriseProduct[];
  subscribers: SubscriberIdentity[];
  subscriptions: SubscriptionRecord[];
  plans: PlanRecord[];
  payments: PaymentRecord[];
  pages: CmsPage[];
  articles: CmsArticle[];
  projects: PortfolioProject[];
  services: ServiceOffering[];
  media: MediaAsset[];
  redirects: SeoRedirect[];
  leads: CrmLead[];
  tasks: CrmTask[];
  users: StaffUser[];
  auditLogs: AuditLogEntry[];
  syncLogs: SyncLogEntry[];
  processedWebhookNonces: string[];
  backupsMeta: BackupSnapshot[];
  websiteSettings: WebsiteSettings;
  orgSettings: OrgSettings;
}
