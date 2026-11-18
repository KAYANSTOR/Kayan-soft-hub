import React, { useState } from 'react';
import { ExternalLink, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { hubApi, type BootstrapPayload } from '../lib/api';
import { hasPermission } from '../shared/domain';
import type { EnterpriseProduct } from '../shared/types';
import { formatIsoShort, SectionHeader, StatusText } from './ui/Primitives';

export function ProductsView({
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
  const [selectedId, setSelectedId] = useState<string>(data.products[0]?.id || '');
  const [showAdd, setShowAdd] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({
    name: '',
    repository: '',
    sourceOfTruth: '',
    description: '',
    websiteUrl: 'https://kayansoft.sa',
    adminUrl: 'https://admin.kayansoft.sa',
  });

  const canManage = hasPermission(data.currentUser, 'products.manage');
  const canSync = hasPermission(data.currentUser, 'integrations.manage');

  const filtered = data.products.filter(
    (p) =>
      !searchQuery.trim() ||
      p.name.includes(searchQuery.trim()) ||
      p.repository.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const selected: EnterpriseProduct | undefined =
    filtered.find((p) => p.id === selectedId) || filtered[0];

  async function handleSync(productId: string) {
    setSyncingId(productId);
    try {
      const res = await hubApi.syncProduct(productId);
      await onRefresh();
      onNotify(res.syncEntry.message, res.syncEntry.status === 'failed' ? 'error' : 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذرت المزامنة', 'error');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleToggleService(product: EnterpriseProduct) {
    try {
      await hubApi.updateProduct(product.id, { serviceActive: !product.serviceActive });
      await onRefresh();
      onNotify(
        product.serviceActive
          ? `تم إيقاف الموصل الإداري للمنتج (${product.name}) دون التأثير على تشغيله المستقل.`
          : `تم إعادة تفعيل موصل (${product.name}).`,
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر تحديث المنتج', 'error');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await hubApi.createProduct(newForm);
      setShowAdd(false);
      setNewForm({ name: '', repository: '', sourceOfTruth: '', description: '', websiteUrl: 'https://kayansoft.sa', adminUrl: 'https://admin.kayansoft.sa' });
      await onRefresh();
      setSelectedId(created.id);
      onNotify(`تمت إضافة المنتج (${created.name}) وتجهيز سجل الموصل الخاص به.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر إضافة المنتج', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="منتجات المؤسسة وموصلات التكامل"
        subtitle="كل منتج يحتفظ بقاعدة بياناته ونظامه التشغيلي المستقل؛ يتصل المركز به عبر واجهات API معتمدة فقط."
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-sm font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتج جديد</span>
            </button>
          ) : undefined
        }
      />

      {showAdd && (
        <form onSubmit={handleCreate} className="bg-white border border-[#705267] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-[#211D25]">تسجيل منتج مؤسسي جديد في المركز</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#423441] mb-1">اسم المنتج</label>
              <input
                required
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="مثال: منصة الفواتير الذكية"
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#423441] mb-1">مستودع GitHub</label>
              <input
                required
                value={newForm.repository}
                onChange={(e) => setNewForm({ ...newForm, repository: e.target.value })}
                placeholder="KAYANSTOR/New-Product"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#423441] mb-1">مصدر الحقيقة المعتمد</label>
              <input
                value={newForm.sourceOfTruth}
                onChange={(e) => setNewForm({ ...newForm, sourceOfTruth: e.target.value })}
                placeholder="Product Billing API"
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#423441] mb-1">رابط لوحة الإدارة الأصلية</label>
              <input
                value={newForm.adminUrl}
                onChange={(e) => setNewForm({ ...newForm, adminUrl: e.target.value })}
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#423441] mb-1">الوصف</label>
            <textarea
              rows={2}
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg border border-[#C5AEB5] text-sm text-[#423441]"
            >
              إلغاء
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-sm font-medium">
              حفظ المنتج
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-3">
          {filtered.map((prod) => {
            const isSelected = selected?.id === prod.id;
            return (
              <button
                key={prod.id}
                type="button"
                onClick={() => setSelectedId(prod.id)}
                className={`w-full text-right p-4 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-white border-[#705267]'
                    : 'bg-white/80 border-[#D8C7CD] hover:border-[#987988]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-[#211D25]">{prod.name}</h3>
                    <p className="text-xs text-[#6A5866] font-mono-nums mt-0.5" dir="ltr">
                      {prod.repository} ({prod.defaultBranch})
                    </p>
                  </div>
                  <StatusText
                    tone={
                      !prod.serviceActive
                        ? 'danger'
                        : prod.auditStatus === 'ready'
                          ? 'success'
                          : prod.auditStatus === 'needs_audit'
                            ? 'warning'
                            : 'neutral'
                    }
                    label={
                      !prod.serviceActive
                        ? 'متوقف إدارياً'
                        : prod.auditStatus === 'ready'
                          ? 'جاهز للتكامل'
                          : prod.auditStatus === 'needs_audit'
                            ? 'يحتاج تدقيقاً'
                            : 'مقيد الخصوصية'
                    }
                  />
                </div>
                <p className="text-xs text-[#423441] mt-2 line-clamp-2">{prod.description}</p>
                <div className="mt-3 pt-2.5 border-t border-[#EEE2DF] flex items-center justify-between text-[11px] text-[#6A5866]">
                  <span>المشتركون: {data.subscriptions.filter((s) => s.productId === prod.id).length}</span>
                  <span className="tabular-nums">آخر مزامنة: {formatIsoShort(prod.lastSyncAt)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7">
          {selected ? (
            <div className="bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#EEE2DF]">
                <div>
                  <h3 className="text-xl font-bold text-[#211D25]">{selected.name}</h3>
                  <p className="text-xs text-[#6A5866] mt-1">
                    {selected.repository} · الفرع الافتراضي: {selected.defaultBranch} · التقنيات:{' '}
                    {selected.techStack.join(' / ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canSync && (
                    <button
                      type="button"
                      disabled={syncingId === selected.id}
                      onClick={() => handleSync(selected.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-xs font-medium whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingId === selected.id ? 'animate-spin' : ''}`} />
                      <span>مزامنة الآن</span>
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleToggleService(selected)}
                      className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs font-medium text-[#423441] hover:bg-[#EEE2DF] whitespace-nowrap"
                    >
                      {selected.serviceActive ? 'تعطيل الربط' : 'تفعيل الربط'}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 rounded-lg bg-[#F6F1EF] border border-[#EEE2DF]">
                  <div className="text-xs text-[#6A5866] mb-1">مصدر الحقيقة المعتمد</div>
                  <div className="font-bold text-[#211D25]">{selected.sourceOfTruth}</div>
                </div>
                <div className="p-4 rounded-lg bg-[#F6F1EF] border border-[#EEE2DF]">
                  <div className="text-xs text-[#6A5866] mb-1">حالة الموصل وآخر اتصال</div>
                  <div className="font-bold text-[#211D25] tabular-nums">{formatIsoShort(selected.lastSyncAt)}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#D8C7CD] bg-[#FAF7F6] space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#211D25]">
                  <ShieldAlert className="w-4 h-4 text-[#705267]" />
                  <span>نتائج الفحص الهندسي وضوابط الفصل</span>
                </div>
                <p className="text-xs text-[#423441] leading-relaxed">{selected.auditSummary}</p>
                <p className="text-xs text-[#6A5866]">{selected.privacyNotes}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h4 className="text-xs font-bold text-[#211D25] mb-2">البيانات المسموح للمركز بعرضها</h4>
                  <ul className="space-y-1.5 text-xs text-[#423441]">
                    {selected.allowedSharedFields.map((field) => (
                      <li key={field} className="py-1 border-b border-[#EEE2DF] font-mono-nums" dir="ltr">
                        {field}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#211D25] mb-2">الوظائف التشغيلية المستقلة (لا تُنقل للمركز)</h4>
                  <ul className="space-y-1.5 text-xs text-[#6A5866]">
                    {selected.excludedOperationalModules.map((mod) => (
                      <li key={mod} className="py-1 border-b border-[#EEE2DF]">
                        {mod}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EEE2DF] flex flex-wrap items-center gap-4 text-xs">
                <a
                  href={selected.adminUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#705267] hover:text-[#211D25] font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>لوحة المنتج الأصلية</span>
                </a>
                <a
                  href={selected.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#705267] hover:text-[#211D25] font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>صفحة المنتج</span>
                </a>
                <a
                  href={selected.supportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#705267] hover:text-[#211D25] font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>الدعم الفني</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#D8C7CD] rounded-xl p-10 text-center text-sm text-[#6A5866]">
              اختر منتجاً لعرض تفاصيل الربط ومصدر الحقيقة.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
