import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregatePaymentsSafely,
  canAccessProduct,
  findMediaReferences,
  hasPermission,
  isDuplicateLead,
  isWebhookTimestampFresh,
  validateSafeSectionContent,
  validateSubscriptionAction,
} from './domain';
import type { CmsArticle, CmsPage, CrmLead, ExchangeRate, PaymentRecord, PortfolioProject } from './types';

test('RBAC enforces role permissions and active status', () => {
  assert.equal(hasPermission({ role: 'owner', active: true }, 'backups.manage'), true);
  assert.equal(hasPermission({ role: 'content_editor', active: true }, 'subscriptions.action'), false);
  assert.equal(hasPermission({ role: 'content_editor', active: true }, 'cms.publish'), false);
  assert.equal(hasPermission({ role: 'content_editor', active: true }, 'cms.edit'), true);
  assert.equal(hasPermission({ role: 'accountant', active: true }, 'settings.manage'), false);
  assert.equal(hasPermission({ role: 'owner', active: false }, 'dashboard.view'), false);

  assert.equal(canAccessProduct({ allowedProductIds: ['krotak-pro'], active: true }, 'krotak-pro'), true);
  assert.equal(canAccessProduct({ allowedProductIds: ['krotak-pro'], active: true }, 'qatshe'), false);
  assert.equal(canAccessProduct({ allowedProductIds: [], active: true }, 'qatshe'), true);
});

test('Multi-currency aggregation separates currencies and refuses blind sum without exchange rate', () => {
  const payments: PaymentRecord[] = [
    {
      id: 'p1',
      referenceId: 'REF-1',
      subscriberId: 's1',
      subscriberName: 'شبكة النور',
      productId: 'krotak-pro',
      productName: 'كروتك برو',
      amount: 100,
      currency: 'USD',
      paidAt: '2026-11-10T10:00:00Z',
      status: 'paid',
      paymentMethod: 'Stripe',
      dataSource: 'Krotic Admin API',
    },
    {
      id: 'p2',
      referenceId: 'REF-2',
      subscriberId: 's2',
      subscriberName: 'متجر الوفاء',
      productId: 'qatshe',
      productName: 'قاتشي',
      amount: 375,
      currency: 'SAR',
      paidAt: '2026-11-11T10:00:00Z',
      status: 'paid',
      paymentMethod: 'Mada',
      dataSource: 'Qatshe API',
    },
  ];

  const ratesWithSar: ExchangeRate[] = [
    { currency: 'USD', rateToUSD: 1, referenceDate: '2026-11-15', source: 'SAMA' },
    { currency: 'SAR', rateToUSD: 0.2666667, referenceDate: '2026-11-15', source: 'SAMA' },
  ];

  const withRates = aggregatePaymentsSafely(payments, ratesWithSar);
  assert.equal(withRates.byCurrency.USD.paidTotal, 100);
  assert.equal(withRates.byCurrency.SAR.paidTotal, 375);
  assert.equal(withRates.missingRateCurrencies.length, 0);
  assert.equal(withRates.convertedUsdTotal, 200);

  const missingRates = aggregatePaymentsSafely(payments, [ratesWithSar[0]]);
  assert.equal(missingRates.convertedUsdTotal, null);
  assert.deepEqual(missingRates.missingRateCurrencies, ['SAR']);
});

test('Lead deduplication blocks repeat submits within window', () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  const leads: CrmLead[] = [
    {
      id: 'l1',
      name: 'أحمد',
      organization: 'شركة الرائد',
      email: 'ahmad@raed.com',
      phone: '966501234567',
      country: 'SA',
      city: 'الرياض',
      requestedService: 'تطوير منصة سحابية',
      requestedProject: 'منصة تجارة',
      expectedBudget: '15000 USD',
      expectedTimeline: '3 أشهر',
      details: 'تفاصيل',
      source: 'project_request_form',
      stage: 'جديد',
      assigneeId: 'u8',
      assigneeName: 'سارة',
      whatsappNotificationStatus: 'sent',
      createdAt: '2026-11-15T11:45:00Z',
      updatedAt: '2026-11-15T11:45:00Z',
      activities: [],
    },
  ];

  assert.equal(
    isDuplicateLead(leads, { email: 'AHMAD@RAED.COM', phone: '966 501234567', requestedService: 'تطوير منصة سحابية' }, now),
    true,
  );
  assert.equal(
    isDuplicateLead(leads, { email: 'other@raed.com', phone: '966500000000', requestedService: 'تطوير منصة سحابية' }, now),
    false,
  );
});

test('CMS section safety rejects script tags and inline JS handlers', () => {
  assert.equal(validateSafeSectionContent({ title: 'مرحباً بكم في كيان سوفت', body: 'حلول برمجية متكاملة' }).valid, true);
  assert.equal(validateSafeSectionContent({ title: 'عنوان', body: '<script>alert(1)</script>' }).valid, false);
  assert.equal(validateSafeSectionContent({ title: 'عنوان', ctaHref: 'javascript:alert(1)' }).valid, false);
});

test('Media deletion guard finds active references', () => {
  const pages: CmsPage[] = [
    {
      id: 'pg1',
      name: 'الرئيسية',
      slug: '/',
      title: 'الرئيسية',
      description: '',
      status: 'published',
      seoTitle: '',
      seoDescription: '',
      ogImage: '/img/hero.jpg',
      canonicalUrl: '',
      sections: [],
      draftSections: [],
      versions: [],
      createdAt: '',
      updatedAt: '',
      updatedBy: '',
    },
  ];
  const articles: CmsArticle[] = [];
  const projects: PortfolioProject[] = [];
  assert.deepEqual(findMediaReferences('/img/hero.jpg', { pages, articles, projects }), ['صفحة: الرئيسية']);
  assert.deepEqual(findMediaReferences('/img/unused.jpg', { pages, articles, projects }), []);
});

test('Subscription actions enforce valid state transitions and webhook timestamp checks', () => {
  assert.equal(validateSubscriptionAction('expiring_soon', 'renew').allowed, true);
  assert.equal(validateSubscriptionAction('suspended', 'renew').allowed, false);
  assert.equal(validateSubscriptionAction('suspended', 'reactivate').allowed, true);

  const now = Date.parse('2026-11-15T12:00:00Z');
  assert.equal(isWebhookTimestampFresh('2026-11-15T11:57:00Z', now), true);
  assert.equal(isWebhookTimestampFresh('2026-11-15T11:40:00Z', now), false);
});
