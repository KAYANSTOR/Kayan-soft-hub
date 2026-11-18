import React, { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { BootstrapPayload } from '../lib/api';
import { aggregatePaymentsSafely, hasPermission } from '../shared/domain';
import { SectionHeader } from './ui/Primitives';

export function ReportsView({ data }: { data: BootstrapPayload }) {
  const [productFilter, setProductFilter] = useState('all');
  const canExport = hasPermission(data.currentUser, 'reports.export');

  const filteredSubs = data.subscriptions.filter(
    (s) => productFilter === 'all' || s.productId === productFilter,
  );
  const filteredPayments = data.payments.filter(
    (p) => productFilter === 'all' || p.productId === productFilter,
  );
  const breakdown = aggregatePaymentsSafely(filteredPayments, data.orgSettings.exchangeRates);

  const stageCounts = data.orgSettings.crmStages.map((stage) => ({
    stage,
    count: data.leads.filter((l) => l.stage === stage).length,
  }));

  function downloadCsv() {
    const rows = [
      ['النوع', 'المعرف', 'الاسم / المشترك', 'المنتج / المصدر', 'القيمة / المرحلة', 'الحالة', 'التاريخ'].join(','),
      ...filteredSubs.map((s) =>
        ['اشتراك', s.id, `"${s.subscriberName}"`, `"${s.productName}"`, `"${s.planName}"`, s.status, s.endDate].join(','),
      ),
      ...filteredPayments.map((p) =>
        ['دفعة', p.referenceId, `"${p.subscriberName}"`, `"${p.productName}"`, `${p.amount} ${p.currency}`, p.status, p.paidAt.slice(0, 10)].join(','),
      ),
      ...data.leads.map((l) =>
        ['عميل CRM', l.id, `"${l.name}"`, `"${l.requestedService}"`, `"${l.stage}"`, l.source, l.createdAt.slice(0, 10)].join(','),
      ),
    ];
    const bom = '\uFEFF';
    const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kayan-soft-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="التقارير والتحليلات التنفيذية"
        subtitle="تقارير المنتجات والاشتراكات والملخصات المالية (مع احترام تعدد العملات) وأداء المبيعات والمحتوى."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              aria-label="تصفية التقرير حسب المنتج"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white text-[#211D25]"
            >
              <option value="all">كل المنتجات</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {canExport && (
              <>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-xs font-medium whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#C5AEB5] bg-white hover:bg-[#EEE2DF] text-[#211D25] text-xs font-medium whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة / PDF</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#D8C7CD] rounded-xl p-6">
          <h3 className="text-base font-bold text-[#211D25] mb-4">ملخص الاشتراكات حسب المنتج</h3>
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-[#D8C7CD] text-[#6A5866]">
                <th className="py-2 font-medium">المنتج</th>
                <th className="py-2 font-medium">نشط</th>
                <th className="py-2 font-medium">قارب الانتهاء</th>
                <th className="py-2 font-medium">منتهي / موقوف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE2DF]">
              {data.products.map((prod) => {
                const subs = filteredSubs.filter((s) => s.productId === prod.id);
                return (
                  <tr key={prod.id}>
                    <td className="py-2.5 font-medium text-[#211D25]">{prod.name}</td>
                    <td className="py-2.5 tabular-nums text-[#156E3F]">
                      {subs.filter((s) => s.status === 'active').length}
                    </td>
                    <td className="py-2.5 tabular-nums text-[#9A5B13]">
                      {subs.filter((s) => s.status === 'expiring_soon').length}
                    </td>
                    <td className="py-2.5 tabular-nums text-[#B42318]">
                      {subs.filter((s) => s.status === 'expired' || s.status === 'suspended').length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-[#D8C7CD] rounded-xl p-6">
          <h3 className="text-base font-bold text-[#211D25] mb-4">التقرير المالي متعدد العملات</h3>
          <div className="space-y-3">
            {Object.entries(breakdown.byCurrency).map(([cur, info]) => (
              <div key={cur} className="flex items-center justify-between py-2 border-b border-[#EEE2DF] text-sm">
                <span className="font-medium text-[#211D25]">عملة {cur} ({info.count} عملية)</span>
                <span className="font-bold tabular-nums text-[#211D25]">
                  {info.paidTotal.toLocaleString('en-US')} {cur}
                  {info.pendingTotal > 0 ? ` · معلق: ${info.pendingTotal.toLocaleString('en-US')}` : ''}
                </span>
              </div>
            ))}
            <div className="pt-2 flex items-center justify-between text-sm">
              <span className="text-[#6A5866]">الإجمالي المحول للدولار الأمريكي</span>
              <span className="font-bold text-[#705267] tabular-nums">
                {breakdown.convertedUsdTotal !== null
                  ? `$${breakdown.convertedUsdTotal.toLocaleString('en-US')} (سعر ${breakdown.referenceDateUsed})`
                  : 'غير محسوب لعدم توفر سعر الصرف'}
              </span>
            </div>
          </div>
        </section>

        <section className="bg-white border border-[#D8C7CD] rounded-xl p-6">
          <h3 className="text-base font-bold text-[#211D25] mb-4">قمع طلبات العملاء وCRM</h3>
          <div className="space-y-2.5">
            {stageCounts
              .filter((item) => item.count > 0)
              .map((item) => (
                <div key={item.stage} className="flex items-center justify-between text-sm py-1.5 border-b border-[#EEE2DF]">
                  <span className="text-[#423441]">{item.stage}</span>
                  <span className="font-bold tabular-nums text-[#211D25]">{item.count}</span>
                </div>
              ))}
          </div>
        </section>

        <section className="bg-white border border-[#D8C7CD] rounded-xl p-6">
          <h3 className="text-base font-bold text-[#211D25] mb-4">ملخص أداء المحتوى والموقع الرسمي</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-[#EEE2DF]">
              <span className="text-[#423441]">الصفحات المنشورة</span>
              <span className="font-bold tabular-nums">{data.pages.filter((p) => p.status === 'published').length}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[#EEE2DF]">
              <span className="text-[#423441]">المقالات المنشورة</span>
              <span className="font-bold tabular-nums">{data.articles.filter((a) => a.status === 'published').length}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[#EEE2DF]">
              <span className="text-[#423441]">المشاريع في معرض الأعمال</span>
              <span className="font-bold tabular-nums">{data.projects.filter((p) => p.published).length}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[#423441]">إجمالي مشاهدات المقالات</span>
              <span className="font-bold tabular-nums">
                {data.articles.reduce((sum, a) => sum + a.views, 0).toLocaleString('en-US')}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
