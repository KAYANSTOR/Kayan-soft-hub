import React, { useState } from 'react';
import type { BootstrapPayload } from '../lib/api';
import { SectionHeader, StatusText, formatIsoShort } from './ui/Primitives';

export function PlansView({ data }: { data: BootstrapPayload }) {
  const [productFilter, setProductFilter] = useState('all');
  const plans = data.plans
    .filter((pl) => productFilter === 'all' || pl.productId === productFilter)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="الباقات والخطط التجارية"
        subtitle="الخطط المعروضة متزامنة مع مصادر الحقيقة المعتمدة لكل منتج دون إنشاء باقات مركزية متعارضة."
        action={
          <select
            aria-label="تصفية الباقات حسب المنتج"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white text-[#211D25]"
          >
            <option value="all">جميع المنتجات</option>
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <article key={plan.id} className="bg-white border border-[#D8C7CD] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-[#6A5866] mb-2">
                <span>{plan.productName}</span>
                <StatusText
                  tone={plan.sourceSynced ? 'success' : 'warning'}
                  label={plan.sourceSynced ? 'متزامنة مع المصدر' : 'قيد الاعتماد'}
                />
              </div>
              <h3 className="text-lg font-bold text-[#211D25]">{plan.name}</h3>
              <p className="text-xs text-[#6A5866] mt-0.5">{plan.targetAudience}</p>
              <div className="mt-4 pb-4 border-b border-[#EEE2DF] flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#211D25] font-display tabular-nums">
                  {plan.price.toLocaleString('en-US')} {plan.currency}
                </span>
                <span className="text-xs text-[#6A5866]">
                  / {plan.billingCycle === 'monthly' ? 'شهرياً' : plan.billingCycle === 'quarterly' ? 'ربع سنوي' : 'سنوياً'}
                </span>
              </div>
              <p className="text-xs font-medium text-[#423441] mt-4">{plan.usageLimits}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-[#6A5866]">
                {plan.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
            <div className="mt-5 pt-3 border-t border-[#EEE2DF] text-[11px] text-[#6A5866] tabular-nums">
              آخر تحديث: {plan.updatedAt}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function PaymentsView({
  data,
  searchQuery,
}: {
  data: BootstrapPayload;
  searchQuery: string;
}) {
  const [productFilter, setProductFilter] = useState('all');

  const payments = data.payments.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      p.referenceId.toLowerCase().includes(q) ||
      p.subscriberName.toLowerCase().includes(q) ||
      p.productName.toLowerCase().includes(q);
    const matchProd = productFilter === 'all' || p.productId === productFilter;
    return matchSearch && matchProd;
  });

  const summary = data.paymentSummary;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="المدفوعات والملخصات المالية"
        subtitle="تُعرض المبالغ وفق عملتها الأصلية ومصدرها المعتمد دون دمج عملات مختلفة إلا بسعر صرف موثق وتاريخ مرجعي."
        action={
          <select
            aria-label="تصفية المدفوعات حسب المنتج"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white text-[#211D25]"
          >
            <option value="all">جميع المنتجات</option>
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
      />

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(summary.byCurrency).map(([currency, bucket]) => (
            <div key={currency} className="bg-white border border-[#D8C7CD] rounded-xl p-4">
              <div className="text-xs text-[#6A5866]">المحصل بعملة ({currency})</div>
              <div className="text-xl font-bold text-[#211D25] font-display tabular-nums mt-1">
                {bucket.paidTotal.toLocaleString('en-US')} {currency}
              </div>
              <div className="text-xs text-[#6A5866] mt-1 tabular-nums">
                معلق: {bucket.pendingTotal.toLocaleString('en-US')} {currency} · {bucket.count} عمليات
              </div>
            </div>
          ))}
          <div className="bg-[#211D25] text-[#EEE2DF] rounded-xl p-4">
            <div className="text-xs text-[#C5AEB5]">المكافئ الموحد (USD)</div>
            <div className="text-xl font-bold text-white font-display tabular-nums mt-1">
              {summary.convertedUsdTotal !== null
                ? `$${summary.convertedUsdTotal.toLocaleString('en-US')}`
                : 'سعر صرف ناقص'}
            </div>
            <div className="text-[11px] text-[#C5AEB5] mt-1">
              {summary.referenceDateUsed
                ? `مرجع التحويل: ${summary.referenceDateUsed}`
                : `ينقص سعر: ${summary.missingRateCurrencies.join(', ')}`}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b border-[#D8C7CD] bg-[#FAF7F6] text-xs text-[#6A5866]">
                <th className="py-3 px-4 font-medium">الرقم المرجعي</th>
                <th className="py-3 px-4 font-medium">المشترك</th>
                <th className="py-3 px-4 font-medium">المنتج</th>
                <th className="py-3 px-4 font-medium">المبلغ والعملة</th>
                <th className="py-3 px-4 font-medium">وسيلة الدفع</th>
                <th className="py-3 px-4 font-medium">المصدر</th>
                <th className="py-3 px-4 font-medium">التاريخ</th>
                <th className="py-3 px-4 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE2DF]">
              {payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-[#F6F1EF]/60">
                  <td className="py-3 px-4 font-mono-nums text-xs text-[#705267]" dir="ltr">
                    {pay.referenceId}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#211D25]">{pay.subscriberName}</td>
                  <td className="py-3 px-4 text-[#423441]">{pay.productName}</td>
                  <td className="py-3 px-4 font-bold text-[#211D25] tabular-nums">
                    {pay.amount.toLocaleString('en-US')} {pay.currency}
                  </td>
                  <td className="py-3 px-4 text-[#423441]">{pay.paymentMethod}</td>
                  <td className="py-3 px-4 text-xs text-[#6A5866]">{pay.dataSource}</td>
                  <td className="py-3 px-4 text-xs text-[#6A5866] tabular-nums" dir="ltr">
                    {formatIsoShort(pay.paidAt)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusText
                      tone={pay.status === 'paid' ? 'success' : pay.status === 'pending' ? 'warning' : 'danger'}
                      label={pay.status === 'paid' ? 'مدفوعة' : pay.status === 'pending' ? 'معلقة' : 'فاشلة'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
