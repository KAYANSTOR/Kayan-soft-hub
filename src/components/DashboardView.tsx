import React from 'react';
import { ArrowUpLeft, RefreshCw } from 'lucide-react';
import type { BootstrapPayload } from '../lib/api';
import { hasPermission } from '../shared/domain';
import type { NavSectionId } from './Sidebar';
import { formatIsoShort, SectionHeader, StatusText } from './ui/Primitives';

export function DashboardView({
  data,
  onNavigate,
}: {
  data: BootstrapPayload;
  onNavigate: (section: NavSectionId) => void;
}) {
  const { products, subscribers, subscriptions, leads, articles, projects, syncLogs, auditLogs, paymentSummary, currentUser } =
    data;

  const connectedCount = products.filter((p) => p.connectorHealth === 'connected' && p.serviceActive).length;
  const offlineOrDegraded = products.filter((p) => p.connectorHealth !== 'connected' || !p.serviceActive).length;
  const activeSubs = subscriptions.filter((s) => s.status === 'active').length;
  const expiringSubs = subscriptions.filter((s) => s.status === 'expiring_soon');
  const expiredSubs = subscriptions.filter((s) => s.status === 'expired').length;
  const suspendedSubs = subscriptions.filter((s) => s.status === 'suspended').length;
  const newLeads = leads.filter((l) => l.stage === 'جديد');
  const publishedArticles = articles.filter((a) => a.status === 'published').length;
  const latestSync = syncLogs[0]?.timestamp;

  const kpis = [
    {
      label: 'المنتجات والموصلات',
      value: `${products.length}`,
      meta: `${connectedCount} متصلة · ${offlineOrDegraded} قيد التدقيق أو التنبيه`,
      source: 'سجل موصلات المنتجات',
      visible: hasPermission(currentUser, 'products.view'),
      target: 'products' as NavSectionId,
    },
    {
      label: 'المشتركين والاشتراكات النشطة',
      value: `${subscribers.length} / ${activeSubs}`,
      meta: `${expiringSubs.length} قاربت على الانتهاء · ${expiredSubs} منتهية · ${suspendedSubs} موقوفة`,
      source: 'مصادر حقيقة المنتجات',
      visible: hasPermission(currentUser, 'subscriptions.view'),
      target: 'subscriptions' as NavSectionId,
    },
    {
      label: 'المدفوعات المحصلة (مقيم بالدولار)',
      value: paymentSummary?.convertedUsdTotal !== null && paymentSummary?.convertedUsdTotal !== undefined
        ? `$${paymentSummary.convertedUsdTotal.toLocaleString('en-US')}`
        : 'متعددة العملات',
      meta: paymentSummary?.referenceDateUsed
        ? `وفق سعر صرف ${paymentSummary.referenceDateUsed}`
        : 'راجع تفاصيل العملات في المدفوعات',
      source: 'Stripe وواجهات الفوترة',
      visible: hasPermission(currentUser, 'payments.view') && paymentSummary !== null,
      target: 'payments' as NavSectionId,
    },
    {
      label: 'طلبات العملاء والمحتوى',
      value: `${leads.length}`,
      meta: `${newLeads.length} طلب جديد · ${publishedArticles} مقال · ${projects.length} مشروع`,
      source: 'قاعدة بيانات المركز CRM & CMS',
      visible: hasPermission(currentUser, 'crm.view') || hasPermission(currentUser, 'cms.view'),
      target: hasPermission(currentUser, 'crm.view') ? ('crm' as NavSectionId) : ('cms' as NavSectionId),
    },
  ].filter((k) => k.visible);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="لوحة القيادة التنفيذية"
        subtitle={`نظرة موحدة على حالة المؤسسة ومنتجاتها المستقلة · آخر مزامنة مسجلة: ${formatIsoShort(latestSync)}`}
        action={
          hasPermission(currentUser, 'integrations.view') ? (
            <button
              type="button"
              onClick={() => onNavigate('integrations')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              <span>مراقبة التكاملات والمزامنة</span>
            </button>
          ) : undefined
        }
      />

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="المؤشرات الرئيسية">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.target)}
            className="text-right bg-white border border-[#D8C7CD] hover:border-[#705267] rounded-xl p-5 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-medium text-[#6A5866]">{kpi.label}</span>
              <ArrowUpLeft className="w-4 h-4 text-[#987988] shrink-0" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-[#211D25] font-display tabular-nums mb-2">{kpi.value}</div>
            <div className="text-xs text-[#423441]">{kpi.meta}</div>
            <div className="text-[11px] text-[#6A5866] mt-3 pt-2.5 border-t border-[#EEE2DF]">
              المصدر: {kpi.source}
            </div>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Product Connectors & Phase 0 Status */}
        {hasPermission(currentUser, 'products.view') && (
          <section className="xl:col-span-7 bg-white border border-[#D8C7CD] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#211D25]">حالة منتجات المؤسسة وموصلات التكامل</h3>
                <p className="text-xs text-[#6A5866] mt-0.5">
                  كل منتج يحتفظ بقاعدة بياناته المستقلة ويتواصل عبر واجهة API مصرح بها
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="text-xs font-medium text-[#705267] hover:text-[#211D25] whitespace-nowrap"
              >
                عرض الكل
              </button>
            </div>
            <div className="divide-y divide-[#EEE2DF]">
              {products.map((prod) => (
                <div key={prod.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#211D25]">{prod.name}</span>
                      <span className="text-xs text-[#6A5866] font-mono-nums" dir="ltr">
                        {prod.repository}
                      </span>
                    </div>
                    <p className="text-xs text-[#6A5866] mt-1 leading-relaxed">
                      مصدر الحقيقة: {prod.sourceOfTruth} · آخر مزامنة: <span className="tabular-nums">{formatIsoShort(prod.lastSyncAt)}</span>
                    </p>
                  </div>
                  <div className="shrink-0">
                    {prod.auditStatus === 'ready' && prod.connectorHealth === 'connected' && (
                      <StatusText tone="success" label="متصل وجاهز للتكامل" />
                    )}
                    {prod.auditStatus === 'needs_audit' && (
                      <StatusText tone="warning" label="يحتاج تدقيقاً أمنياً" />
                    )}
                    {prod.auditStatus === 'restricted_privacy' && (
                      <StatusText tone="neutral" label="مقيد بالخصوصية" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Expiring Subscriptions & Recent CRM Leads */}
        <section className="xl:col-span-5 space-y-6">
          {hasPermission(currentUser, 'subscriptions.view') && (
            <div className="bg-white border border-[#D8C7CD] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#211D25]">اشتراكات تتطلب متابعة</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('subscriptions')}
                  className="text-xs font-medium text-[#705267] hover:text-[#211D25]"
                >
                  إدارة الاشتراكات
                </button>
              </div>
              {expiringSubs.length === 0 && expiredSubs === 0 ? (
                <p className="text-sm text-[#6A5866]">جميع الاشتراكات الحالية مستقرة ومجددة.</p>
              ) : (
                <div className="divide-y divide-[#EEE2DF]">
                  {subscriptions
                    .filter((s) => s.status === 'expiring_soon' || s.status === 'expired')
                    .map((sub) => (
                      <div key={sub.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#211D25] truncate">{sub.subscriberName}</div>
                          <div className="text-xs text-[#6A5866] mt-0.5">
                            {sub.productName} · ينتهي في <span className="tabular-nums">{sub.endDate}</span>
                          </div>
                        </div>
                        <StatusText
                          tone={sub.status === 'expired' ? 'danger' : 'warning'}
                          label={sub.status === 'expired' ? 'منتهي' : 'قارب على الانتهاء'}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {hasPermission(currentUser, 'crm.view') && (
            <div className="bg-white border border-[#D8C7CD] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#211D25]">أحدث طلبات العملاء والمشاريع</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('crm')}
                  className="text-xs font-medium text-[#705267] hover:text-[#211D25]"
                >
                  لوحة CRM
                </button>
              </div>
              <div className="divide-y divide-[#EEE2DF]">
                {leads.slice(0, 4).map((lead) => (
                  <div key={lead.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#211D25] truncate">
                        {lead.name} — {lead.organization}
                      </div>
                      <div className="text-xs text-[#6A5866] mt-0.5 truncate">
                        {lead.requestedService} · {lead.stage}
                      </div>
                    </div>
                    <span className="text-xs text-[#6A5866] tabular-nums shrink-0">
                      {lead.createdAt.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Recent Audit Trail */}
      {hasPermission(currentUser, 'audit.view') && (
        <section className="bg-white border border-[#D8C7CD] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#211D25]">آخر العمليات الإدارية المسجلة في سجل التدقيق</h3>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-xs font-medium text-[#705267] hover:text-[#211D25]"
            >
              السجل الكامل
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-[#D8C7CD] text-xs text-[#6A5866]">
                  <th className="py-2.5 px-3 font-medium">الوقت</th>
                  <th className="py-2.5 px-3 font-medium">المنفذ</th>
                  <th className="py-2.5 px-3 font-medium">العملية</th>
                  <th className="py-2.5 px-3 font-medium">الهدف</th>
                  <th className="py-2.5 px-3 font-medium">النتيجة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE2DF]">
                {auditLogs.slice(0, 5).map((log) => (
                  <tr key={log.id} className="hover:bg-[#F6F1EF]/60">
                    <td className="py-2.5 px-3 text-xs text-[#6A5866] tabular-nums whitespace-nowrap" dir="ltr">
                      {formatIsoShort(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#211D25] whitespace-nowrap">{log.actorName}</td>
                    <td className="py-2.5 px-3 text-[#423441]">{log.action}</td>
                    <td className="py-2.5 px-3 text-[#6A5866]">{log.targetLabel}</td>
                    <td className="py-2.5 px-3">
                      <StatusText
                        tone={log.status === 'success' ? 'success' : log.status === 'denied' ? 'warning' : 'danger'}
                        label={log.status === 'success' ? 'ناجحة' : log.status === 'denied' ? 'مرفوضة' : 'فشلت'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
