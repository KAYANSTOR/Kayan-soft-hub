import React, { useState } from 'react';
import { hubApi, type BootstrapPayload } from '../lib/api';
import { hasPermission } from '../shared/domain';
import type { SubscriptionActionType, SubscriptionRecord } from '../shared/types';
import { ConfirmModal, formatIsoShort, SectionHeader, StatusText } from './ui/Primitives';

export function SubscriptionsView({
  data,
  searchQuery,
  onRefresh,
  onNotify,
}: {
  data: BootstrapPayload;
  searchQuery: string;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}) {
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingAction, setPendingAction] = useState<{
    sub: SubscriptionRecord;
    action: SubscriptionActionType;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canAct = hasPermission(data.currentUser, 'subscriptions.action');

  const filtered = data.subscriptions.filter((sub) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      sub.subscriberName.toLowerCase().includes(q) ||
      sub.externalAccountId.toLowerCase().includes(q) ||
      sub.planName.toLowerCase().includes(q);
    const matchesProd = productFilter === 'all' || sub.productId === productFilter;
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesProd && matchesStatus;
  });

  async function executeAction() {
    if (!pendingAction) return;
    setSubmitting(true);
    try {
      const res = await hubApi.subscriptionAction(pendingAction.sub.id, pendingAction.action);
      await onRefresh();
      onNotify(res.message);
      setPendingAction(null);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء عبر موصل المنتج', 'error');
      setPendingAction(null);
    } finally {
      setSubmitting(false);
    }
  }

  const actionTitle = (a: SubscriptionActionType) =>
    a === 'renew' ? 'تأكيد طلب التجديد عبر API المنتج' : a === 'suspend' ? 'تأكيد إيقاف الاشتراك' : 'تأكيد إعادة التفعيل';

  return (
    <div className="space-y-6">
      <SectionHeader
        title="إدارة الاشتراكات والتراخيص"
        subtitle="يتم تمرير جميع طلبات التجديد والإيقاف وإعادة التفعيل عبر واجهة API المعتمدة لكل منتج مع تسجيل الرقم المرجعي."
      />

      <div className="bg-white border border-[#D8C7CD] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <select
          aria-label="تصفية الاشتراكات حسب المنتج"
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

        <div className="flex items-center gap-1 p-1 bg-[#EEE2DF] rounded-lg">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'active', label: 'نشط' },
            { id: 'expiring_soon', label: 'قارب على الانتهاء' },
            { id: 'expired', label: 'منتهي' },
            { id: 'suspended', label: 'موقوف' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === tab.id ? 'bg-white text-[#211D25]' : 'text-[#423441] hover:text-[#211D25]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b border-[#D8C7CD] bg-[#FAF7F6] text-xs text-[#6A5866]">
                <th className="py-3 px-4 font-medium">المشترك</th>
                <th className="py-3 px-4 font-medium">المنتج والحساب</th>
                <th className="py-3 px-4 font-medium">الباقة</th>
                <th className="py-3 px-4 font-medium">الانتهاء</th>
                <th className="py-3 px-4 font-medium">مصدر الحقيقة</th>
                <th className="py-3 px-4 font-medium">الحالة</th>
                <th className="py-3 px-4 font-medium">إجراءات API المعتمدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE2DF]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-[#6A5866]">
                    لا توجد اشتراكات مطابقة لمعايير البحث.
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#F6F1EF]/60">
                    <td className="py-3 px-4 font-medium text-[#211D25]">{sub.subscriberName}</td>
                    <td className="py-3 px-4">
                      <div className="text-[#211D25] font-medium">{sub.productName}</div>
                      <div className="text-xs text-[#6A5866] font-mono-nums" dir="ltr">
                        {sub.externalAccountId}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#423441]">{sub.planName}</td>
                    <td className="py-3 px-4 tabular-nums text-[#211D25] whitespace-nowrap">{sub.endDate}</td>
                    <td className="py-3 px-4 text-xs text-[#6A5866]">
                      <div>{sub.sourceOfTruth}</div>
                      {sub.lastActionRef && (
                        <div className="font-mono-nums text-[11px] text-[#705267]" dir="ltr">
                          {sub.lastActionRef}
                        </div>
                      )}
                      <div className="text-[11px] tabular-nums">مزامنة: {formatIsoShort(sub.lastSyncedAt)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusText
                        tone={
                          sub.status === 'active'
                            ? 'success'
                            : sub.status === 'expiring_soon'
                              ? 'warning'
                              : 'danger'
                        }
                        label={
                          sub.status === 'active'
                            ? 'نشط'
                            : sub.status === 'expiring_soon'
                              ? 'قارب على الانتهاء'
                              : sub.status === 'expired'
                                ? 'منتهي'
                                : 'موقوف'
                        }
                      />
                    </td>
                    <td className="py-3 px-4">
                      {canAct ? (
                        <div className="flex items-center gap-2">
                          {sub.status !== 'suspended' && (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ sub, action: 'renew' })}
                              className="px-2.5 py-1.5 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-xs font-medium whitespace-nowrap"
                            >
                              طلب تجديد
                            </button>
                          )}
                          {sub.status !== 'suspended' ? (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ sub, action: 'suspend' })}
                              className="px-2.5 py-1.5 rounded-lg border border-[#C5AEB5] hover:bg-[#EEE2DF] text-[#423441] text-xs font-medium whitespace-nowrap"
                            >
                              إيقاف
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingAction({ sub, action: 'reactivate' })}
                              className="px-2.5 py-1.5 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-xs font-medium whitespace-nowrap"
                            >
                              إعادة تفعيل
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#6A5866]">للعرض فقط</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pendingAction)}
        title={pendingAction ? actionTitle(pendingAction.action) : ''}
        description={
          pendingAction
            ? `سيتم إرسال طلب (${
                pendingAction.action === 'renew' ? 'تجديد شهر إضافي' : pendingAction.action === 'suspend' ? 'إيقاف' : 'إعادة تفعيل'
              }) لاشتراك "${pendingAction.sub.subscriberName}" في "${pendingAction.sub.productName}" عبر مصدر الحقيقة (${pendingAction.sub.sourceOfTruth}) وتسجيل رقم مرجعي في سجل التدقيق.`
            : ''
        }
        confirmLabel="تنفيذ عبر API المعتمد"
        danger={pendingAction?.action === 'suspend'}
        loading={submitting}
        onConfirm={executeAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
