import React, { useState } from 'react';
import { ExternalLink, MessageSquarePlus } from 'lucide-react';
import { hubApi, type BootstrapPayload } from '../lib/api';
import { hasPermission } from '../shared/domain';
import type { SubscriberIdentity } from '../shared/types';
import { formatIsoShort, SectionHeader, StatusText } from './ui/Primitives';

export function SubscribersView({
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
  const [selectedId, setSelectedId] = useState<string>(data.subscribers[0]?.id || '');
  const [noteInput, setNoteInput] = useState('');

  const canManage = hasPermission(data.currentUser, 'subscribers.manage');

  const filtered = data.subscribers.filter((sub) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      sub.displayName.toLowerCase().includes(q) ||
      sub.organizationName.toLowerCase().includes(q) ||
      sub.email.toLowerCase().includes(q) ||
      sub.phone.includes(q) ||
      sub.linkedAccounts.some((acc) => acc.externalAccountId.toLowerCase().includes(q));

    const matchesProduct =
      productFilter === 'all' || sub.linkedAccounts.some((acc) => acc.productId === productFilter);

    const subSubscriptions = data.subscriptions.filter((s) => s.subscriberId === sub.id);
    const matchesStatus =
      statusFilter === 'all' || subSubscriptions.some((s) => s.status === statusFilter);

    return matchesSearch && matchesProduct && matchesStatus;
  });

  const selected: SubscriberIdentity | undefined =
    filtered.find((s) => s.id === selectedId) || filtered[0];

  const selectedSubscriptions = selected
    ? data.subscriptions.filter((s) => s.subscriberId === selected.id)
    : [];
  const selectedPayments = selected
    ? data.payments.filter((p) => p.subscriberId === selected.id)
    : [];

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !noteInput.trim()) return;
    try {
      await hubApi.addSubscriberNote(selected.id, noteInput);
      setNoteInput('');
      await onRefresh();
      onNotify('تم حفظ الملاحظة الإدارية في ملف المشترك.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ الملاحظة', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="المشتركين والحسابات المرتبطة"
        subtitle="فصل تام بين هوية المؤسسة المشتركة وحساباتها الخارجية في كل منتج — لا تُدمج الحسابات بناءً على تشابه الأسماء."
      />

      <div className="bg-white border border-[#D8C7CD] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <select
          aria-label="تصفية حسب المنتج"
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

        <select
          aria-label="تصفية حسب حالة الاشتراك"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white text-[#211D25]"
        >
          <option value="all">جميع حالات الاشتراك</option>
          <option value="active">نشط</option>
          <option value="expiring_soon">قارب على الانتهاء</option>
          <option value="expired">منتهي</option>
          <option value="suspended">موقوف</option>
        </select>

        <span className="text-xs text-[#6A5866] mr-auto tabular-nums">
          النتائج: {filtered.length} مشترك
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#D8C7CD] rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#6A5866]">لا توجد نتائج مطابقة للتصفية الحالية.</div>
          ) : (
            <div className="divide-y divide-[#EEE2DF]">
              {filtered.map((sub) => {
                const isSel = selected?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedId(sub.id)}
                    className={`w-full text-right p-4 transition-colors ${
                      isSel ? 'bg-[#EEE2DF]/70' : 'hover:bg-[#F6F1EF]'
                    }`}
                  >
                    <div className="font-bold text-sm text-[#211D25]">{sub.displayName}</div>
                    <div className="text-xs text-[#6A5866] mt-0.5">{sub.email} · {sub.city}، {sub.country}</div>
                    <div className="mt-2 text-[11px] text-[#423441]">
                      الحسابات الخارجية ({sub.linkedAccounts.length}):{' '}
                      {sub.linkedAccounts.map((a) => `${a.productName} (${a.externalAccountId})`).join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          {selected ? (
            <div className="bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-6">
              <div className="pb-4 border-b border-[#EEE2DF]">
                <h3 className="text-xl font-bold text-[#211D25]">{selected.displayName}</h3>
                <p className="text-xs text-[#6A5866] mt-1">
                  {selected.organizationName} · {selected.email} · <span dir="ltr">{selected.phone}</span> · {selected.city}، {selected.country}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#211D25] mb-3">
                  الحسابات الخارجية المرتبطة (هويات منفصلة لكل منتج)
                </h4>
                <div className="space-y-3">
                  {selected.linkedAccounts.map((acc) => {
                    const prod = data.products.find((p) => p.id === acc.productId);
                    return (
                      <div key={acc.id} className="p-4 rounded-lg border border-[#D8C7CD] bg-[#FAF7F6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-[#211D25]">
                            {acc.productName} — {acc.accountDisplayName}
                          </div>
                          <div className="text-xs text-[#6A5866] mt-1 font-mono-nums" dir="ltr">
                            ID: {acc.externalAccountId} {acc.externalTenantCode ? `· ${acc.externalTenantCode}` : ''}
                          </div>
                          {acc.deviceStatus && (
                            <div className="text-xs text-[#423441] mt-1">{acc.deviceStatus}</div>
                          )}
                          <div className="text-[11px] text-[#6A5866] mt-1">
                            المصدر: {acc.sourceOfTruth} · آخر مزامنة: {formatIsoShort(acc.lastSyncedAt)}
                          </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                          <StatusText
                            tone={
                              acc.accountStatus === 'active'
                                ? 'success'
                                : acc.accountStatus === 'pending_audit'
                                  ? 'neutral'
                                  : 'danger'
                            }
                            label={
                              acc.accountStatus === 'active'
                                ? 'حساب نشط'
                                : acc.accountStatus === 'suspended'
                                  ? 'حساب موقوف'
                                  : acc.accountStatus === 'expired'
                                    ? 'منتهي'
                                    : 'بانتظار التدقيق'
                            }
                          />
                          {prod && (
                            <a
                              href={prod.adminUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#705267] hover:text-[#211D25]"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>الانتقال إلى لوحة المنتج</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#211D25] mb-3">الاشتراكات والباقات</h4>
                {selectedSubscriptions.length === 0 ? (
                  <p className="text-xs text-[#6A5866]">لا توجد اشتراكات مسجلة لهذا المشترك.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="border-b border-[#D8C7CD] text-[#6A5866]">
                          <th className="py-2 px-2 font-medium">المنتج</th>
                          <th className="py-2 px-2 font-medium">الباقة</th>
                          <th className="py-2 px-2 font-medium">الفترة</th>
                          <th className="py-2 px-2 font-medium">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEE2DF]">
                        {selectedSubscriptions.map((sub) => (
                          <tr key={sub.id}>
                            <td className="py-2 px-2 font-medium text-[#211D25]">{sub.productName}</td>
                            <td className="py-2 px-2 text-[#423441]">{sub.planName}</td>
                            <td className="py-2 px-2 tabular-nums text-[#6A5866]">{sub.startDate} → {sub.endDate}</td>
                            <td className="py-2 px-2">
                              <StatusText
                                tone={sub.status === 'active' ? 'success' : sub.status === 'expiring_soon' ? 'warning' : 'danger'}
                                label={
                                  sub.status === 'active'
                                    ? 'نشط'
                                    : sub.status === 'expiring_soon'
                                      ? 'قارب الانتهاء'
                                      : sub.status === 'expired'
                                        ? 'منتهي'
                                        : 'موقوف'
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedPayments.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-[#211D25] mb-2">ملخص المدفوعات المصرح بها</h4>
                  <div className="space-y-1.5 text-xs">
                    {selectedPayments.map((pay) => (
                      <div key={pay.id} className="flex items-center justify-between py-1.5 border-b border-[#EEE2DF]">
                        <span className="text-[#423441]">
                          {pay.productName} · <span className="font-mono-nums">{pay.referenceId}</span>
                        </span>
                        <span className="font-bold text-[#211D25] tabular-nums">
                          {pay.amount.toLocaleString('en-US')} {pay.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-[#211D25] mb-2">ملاحظات إدارية</h4>
                <ul className="space-y-1.5 text-xs text-[#423441] mb-3">
                  {selected.notes.map((n, idx) => (
                    <li key={idx} className="p-2.5 rounded-lg bg-[#F6F1EF]">{n}</li>
                  ))}
                </ul>
                {canManage && (
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="إضافة ملاحظة إدارية..."
                      className="flex-1 px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium whitespace-nowrap"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>إضافة</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#D8C7CD] rounded-xl p-10 text-center text-sm text-[#6A5866]">
              اختر مشتركاً لعرض ملفه التفصيلي وحساباته الخارجية.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
