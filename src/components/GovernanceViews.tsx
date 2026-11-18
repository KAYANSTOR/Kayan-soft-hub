import React, { useState } from 'react';
import { Download, HardDriveUpload, Plus, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { hubApi, type BootstrapPayload } from '../lib/api';
import { hasPermission, ROLE_LABELS_AR, ROLE_PERMISSIONS } from '../shared/domain';
import type { UserRole } from '../shared/types';
import { ConfirmModal, formatIsoShort, SectionHeader, StatusText } from './ui/Primitives';

export function UsersRolesView({
  data,
  onRefresh,
  onNotify,
  onSwitchRole,
}: {
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
  onSwitchRole: (role: UserRole) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'content_editor' as UserRole, mfaEnabled: false });
  const canManage = hasPermission(data.currentUser, 'users.manage');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await hubApi.createUser(form);
      setShowAdd(false);
      setForm({ name: '', email: '', role: 'content_editor', mfaEnabled: false });
      await onRefresh();
      onNotify('تم إنشاء حساب الموظف وتطبيق صلاحيات الدور على الخادم.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر إنشاء المستخدم', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="المستخدمون والأدوار والصلاحيات (RBAC)"
        subtitle="تُفرض الصلاحيات على الخادم في كل طلب API. يمكنك اختبار أي دور فوراً للتحقق من حدود الوصول."
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موظف</span>
            </button>
          ) : undefined
        }
      />

      {showAdd && (
        <form onSubmit={handleCreate} className="bg-white border border-[#705267] rounded-xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">الاسم</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">البريد المؤسسي</label>
            <input
              required
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">الدور</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
            >
              {Object.entries(ROLE_LABELS_AR).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-sm font-medium">
            حفظ الموظف
          </button>
        </form>
      )}

      <div className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b border-[#D8C7CD] bg-[#FAF7F6] text-xs text-[#6A5866]">
                <th className="py-3 px-4 font-medium">الموظف</th>
                <th className="py-3 px-4 font-medium">البريد</th>
                <th className="py-3 px-4 font-medium">الدور</th>
                <th className="py-3 px-4 font-medium">MFA</th>
                <th className="py-3 px-4 font-medium">الحالة</th>
                <th className="py-3 px-4 font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE2DF]">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-[#F6F1EF]/60">
                  <td className="py-3 px-4 font-medium text-[#211D25]">{u.name}</td>
                  <td className="py-3 px-4 text-xs text-[#6A5866] font-mono-nums" dir="ltr">
                    {u.email}
                  </td>
                  <td className="py-3 px-4 text-[#423441]">{ROLE_LABELS_AR[u.role]}</td>
                  <td className="py-3 px-4 text-xs">
                    {u.mfaEnabled ? 'مفعل' : 'غير مفعل'}
                  </td>
                  <td className="py-3 px-4">
                    <StatusText tone={u.active ? 'success' : 'danger'} label={u.active ? 'نشط' : 'موقوف'} />
                  </td>
                  <td className="py-3 px-4 flex items-center gap-2">
                    {canManage && u.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await hubApi.updateUser(u.id, { active: !u.active });
                          await onRefresh();
                          onNotify(u.active ? `تم إيقاف حساب ${u.name}.` : `تم تفعيل حساب ${u.name}.`);
                        }}
                        className="px-2.5 py-1 rounded border border-[#C5AEB5] text-xs hover:bg-[#EEE2DF]"
                      >
                        {u.active ? 'إيقاف' : 'تفعيل'}
                      </button>
                    )}
                    {u.active && u.id !== data.currentUser.id && (
                      <button
                        type="button"
                        onClick={() => onSwitchRole(u.role)}
                        className="px-2.5 py-1 rounded bg-[#EEE2DF] hover:bg-[#C5AEB5] text-[#211D25] text-xs font-medium"
                      >
                        تقمص الدور للاختبار
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#D8C7CD] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-[#705267]" />
          <h3 className="text-base font-bold text-[#211D25]">مصفوفة الصلاحيات حسب الدور</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {(Object.keys(ROLE_LABELS_AR) as UserRole[]).map((role) => (
            <div key={role} className="p-3.5 rounded-lg bg-[#F6F1EF] border border-[#EEE2DF]">
              <div className="font-bold text-[#211D25] mb-1.5">{ROLE_LABELS_AR[role]}</div>
              <div className="text-[#6A5866] leading-relaxed" dir="ltr">
                {ROLE_PERMISSIONS[role].length} permissions: {ROLE_PERMISSIONS[role].slice(0, 5).join(', ')}
                {ROLE_PERMISSIONS[role].length > 5 ? ' ...' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuditLogView({ data, searchQuery }: { data: BootstrapPayload; searchQuery: string }) {
  const [statusFilter, setStatusFilter] = useState('all');

  const logs = data.auditLogs.filter((l) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      l.actorName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.targetLabel.toLowerCase().includes(q) ||
      l.referenceId.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="سجل التدقيق غير القابل للتعديل"
        subtitle="توثيق كامل لجميع العمليات الحساسة ومحاولات الوصول والرفض الأمني مع المنفذ والتوقيت والرقم المرجعي."
        action={
          <div className="flex items-center gap-1 p-1 bg-[#EEE2DF] rounded-lg">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'success', label: 'ناجحة' },
              { id: 'denied', label: 'مرفوضة' },
              { id: 'failed', label: 'فاشلة' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusFilter(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  statusFilter === t.id ? 'bg-white text-[#211D25]' : 'text-[#423441]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-[#D8C7CD] bg-[#FAF7F6] text-[#6A5866]">
                <th className="py-3 px-4 font-medium">التوقيت</th>
                <th className="py-3 px-4 font-medium">المنفذ</th>
                <th className="py-3 px-4 font-medium">القسم</th>
                <th className="py-3 px-4 font-medium">العملية</th>
                <th className="py-3 px-4 font-medium">الهدف</th>
                <th className="py-3 px-4 font-medium">المرجع</th>
                <th className="py-3 px-4 font-medium">التفاصيل</th>
                <th className="py-3 px-4 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE2DF]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F6F1EF]/60">
                  <td className="py-2.5 px-4 tabular-nums text-[#6A5866] whitespace-nowrap" dir="ltr">
                    {formatIsoShort(log.timestamp)}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-[#211D25] whitespace-nowrap">{log.actorName}</td>
                  <td className="py-2.5 px-4 text-[#423441] whitespace-nowrap">{log.module}</td>
                  <td className="py-2.5 px-4 font-medium text-[#211D25]">{log.action}</td>
                  <td className="py-2.5 px-4 text-[#423441]">{log.targetLabel}</td>
                  <td className="py-2.5 px-4 font-mono-nums text-[#705267]" dir="ltr">
                    {log.referenceId}
                  </td>
                  <td className="py-2.5 px-4 text-[#6A5866] max-w-xs truncate">{log.details}</td>
                  <td className="py-2.5 px-4">
                    <StatusText
                      tone={log.status === 'success' ? 'success' : log.status === 'denied' ? 'warning' : 'danger'}
                      label={log.status === 'success' ? 'ناجحة' : log.status === 'denied' ? 'مرفوضة' : 'فاشلة'}
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

export function IntegrationsSyncView({
  data,
  onRefresh,
  onNotify,
}: {
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}) {
  const [backupReason, setBackupReason] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    productId: 'prod-kayan-ai',
    eventId: `evt_${Date.now()}`,
    timestamp: new Date().toISOString(),
    signature: '',
    payload: '{"event":"subscription.renewed","org":"KAI-ORG-4410"}',
  });

  const canManageInt = hasPermission(data.currentUser, 'integrations.manage');
  const canBackup = hasPermission(data.currentUser, 'backups.manage');

  async function handleGenerateWebhookSig() {
    try {
      const sample = await hubApi.generateWebhookSample(
        webhookForm.productId,
        `evt_${Date.now()}`,
        webhookForm.payload,
      );
      setWebhookForm(sample);
      onNotify('تم توليد توقيع HMAC-SHA256 وطابع زمني صالح للاختبار.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر التوليد', 'error');
    }
  }

  async function handleVerifyWebhook(e: React.FormEvent) {
    e.preventDefault();
    try {
      const entry = await hubApi.verifyWebhook(webhookForm);
      await onRefresh();
      onNotify(entry.message);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'فشل التحقق من الـ Webhook', 'error');
    }
  }

  async function handleCreateBackup(e: React.FormEvent) {
    e.preventDefault();
    try {
      const snap = await hubApi.createBackup(backupReason || 'نسخة احتياطية يدوية قبل التحديث');
      setBackupReason('');
      await onRefresh();
      onNotify(`تم إنشاء النسخة الاحتياطية (${snap.id}) بنجاح.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر إنشاء النسخة', 'error');
    }
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return;
    try {
      await hubApi.restoreBackup(restoreTarget);
      setRestoreTarget(null);
      await onRefresh();
      onNotify('تمت استعادة النسخة الاحتياطية لبيانات المنصة المركزية وتسجيل العملية.');
    } catch (err) {
      setRestoreTarget(null);
      onNotify(err instanceof Error ? err.message : 'تعذرت الاستعادة', 'error');
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="التكاملات والمزامنة والنسخ الاحتياطي"
        subtitle="مراقبة موصلات المنتجات، التحقق من توقيع Webhooks ومنع Replay Attack، وإدارة نسخ المركز الاحتياطية."
      />

      {/* Product Sync Controls */}
      <section className="bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-[#211D25]">حالة الموصلات وسجل المزامنة</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.products.map((p) => (
            <div key={p.id} className="p-4 rounded-lg bg-[#F6F1EF] border border-[#EEE2DF] flex flex-col justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-[#211D25]">{p.name}</div>
                <div className="text-[11px] text-[#6A5866] mt-0.5 tabular-nums">
                  آخر مزامنة: {formatIsoShort(p.lastSyncAt)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <StatusText
                  tone={p.syncStatus === 'success' ? 'success' : p.syncStatus === 'warning' ? 'warning' : 'danger'}
                  label={p.syncStatus === 'success' ? 'متزامن' : p.syncStatus === 'warning' ? 'تنبيه' : 'متوقف'}
                />
                {canManageInt && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await hubApi.syncProduct(p.id);
                      await onRefresh();
                      onNotify(res.syncEntry.message);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#C5AEB5] text-xs hover:bg-[#EEE2DF]"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>مزامنة</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pt-3 border-t border-[#EEE2DF]">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-[#D8C7CD] text-[#6A5866]">
                <th className="py-2 px-3 font-medium">الوقت</th>
                <th className="py-2 px-3 font-medium">المنتج</th>
                <th className="py-2 px-3 font-medium">المشغل</th>
                <th className="py-2 px-3 font-medium">السجلات</th>
                <th className="py-2 px-3 font-medium">النتيجة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE2DF]">
              {data.syncLogs.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td className="py-2 px-3 tabular-nums text-[#6A5866]" dir="ltr">{formatIsoShort(s.timestamp)}</td>
                  <td className="py-2 px-3 font-medium text-[#211D25]">{s.productName}</td>
                  <td className="py-2 px-3 text-[#423441]">{s.trigger}</td>
                  <td className="py-2 px-3 tabular-nums">{s.recordsSynced}</td>
                  <td className="py-2 px-3 text-[#423441]">{s.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook Security Verifier */}
        <section className="bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#211D25]">اختبار أمان Webhooks (HMAC + Replay Guard)</h3>
            {canManageInt && (
              <button
                type="button"
                onClick={handleGenerateWebhookSig}
                className="text-xs font-medium text-[#705267] hover:underline"
              >
                توليد توقيع صالح للاختبار
              </button>
            )}
          </div>
          <form onSubmit={handleVerifyWebhook} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={webhookForm.eventId}
                onChange={(e) => setWebhookForm({ ...webhookForm, eventId: e.target.value })}
                placeholder="Event ID"
                dir="ltr"
                className="px-3 py-2 rounded-lg border border-[#C5AEB5] font-mono-nums"
              />
              <input
                value={webhookForm.timestamp}
                onChange={(e) => setWebhookForm({ ...webhookForm, timestamp: e.target.value })}
                placeholder="ISO Timestamp"
                dir="ltr"
                className="px-3 py-2 rounded-lg border border-[#C5AEB5] font-mono-nums"
              />
            </div>
            <input
              value={webhookForm.signature}
              onChange={(e) => setWebhookForm({ ...webhookForm, signature: e.target.value })}
              placeholder="HMAC-SHA256 Signature Hex"
              dir="ltr"
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] font-mono-nums"
            />
            <textarea
              rows={2}
              value={webhookForm.payload}
              onChange={(e) => setWebhookForm({ ...webhookForm, payload: e.target.value })}
              dir="ltr"
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] font-mono-nums"
            />
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#211D25] text-white font-medium">
              التحقق واستقبال الحدث
            </button>
          </form>
        </section>

        {/* Backup & Restore Console */}
        <section className="bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-[#211D25]">النسخ الاحتياطي واستعادة بيانات المركز</h3>
          <p className="text-xs text-[#6A5866]">
            تشمل قاعدة المركز وCMS وCRM والصلاحيات. لا تعد هذه النسخة بديلاً عن النسخ المستقل لقواعد المنتجات.
          </p>
          {canBackup && (
            <form onSubmit={handleCreateBackup} className="flex gap-2">
              <input
                value={backupReason}
                onChange={(e) => setBackupReason(e.target.value)}
                placeholder="سبب النسخة (مثال: قبل نشر تحديثات CMS)..."
                className="flex-1 px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium whitespace-nowrap"
              >
                <HardDriveUpload className="w-3.5 h-3.5" />
                <span>إنشاء نسخة</span>
              </button>
            </form>
          )}

          <div className="divide-y divide-[#EEE2DF] text-xs">
            {data.backupsMeta.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[#211D25] font-mono-nums" dir="ltr">{b.id}</div>
                  <div className="text-[#6A5866] truncate">{b.reason} · {b.createdBy}</div>
                  <div className="text-[11px] text-[#6A5866] tabular-nums">
                    {(b.sizeBytes / 1024).toFixed(1)} KB · {b.checksum}
                  </div>
                </div>
                {canBackup && (
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/api/backups/${b.id}/download`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#C5AEB5] hover:bg-[#EEE2DF]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تنزيل</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setRestoreTarget(b.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#705267] text-[#705267] hover:bg-[#EEE2DF]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>استعادة</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={Boolean(restoreTarget)}
        title="تأكيد استعادة النسخة الاحتياطية"
        description={`سيتم استرجاع جميع بيانات المركز وCMS وCRM من النسخة "${restoreTarget}" وتوثيق اسم المنفذ في سجل التدقيق.`}
        confirmLabel="تأكيد الاستعادة"
        danger
        onConfirm={handleConfirmRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}

export function OrgSettingsView({
  data,
  onRefresh,
  onNotify,
}: {
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
}) {
  const [form, setForm] = useState(data.orgSettings);
  const [stagesText, setStagesText] = useState(data.orgSettings.crmStages.join('\n'));
  const canManage = hasPermission(data.currentUser, 'settings.manage');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const crmStages = stagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await hubApi.updateOrgSettings({ ...form, crmStages });
      await onRefresh();
      onNotify('تم حفظ إعدادات المؤسسة وسياسات الحوكمة بنجاح.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="إعدادات المؤسسة والحوكمة"
        subtitle="إعدادات الهوية الرسمية وسياسات الاحتفاظ بالبيانات وأسعار الصرف المرجعية وتخصيص مراحل CRM."
      />

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-[#211D25]">بيانات المؤسسة والسياسات الأمنية</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">اسم المؤسسة</label>
              <input
                disabled={!canManage}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">الاسم الإنجليزي القانوني</label>
              <input
                disabled={!canManage}
                dir="ltr"
                value={form.legalEntity}
                onChange={(e) => setForm({ ...form, legalEntity: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">الاحتفاظ بسجل التدقيق (أيام)</label>
              <input
                type="number"
                disabled={!canManage}
                value={form.retentionDaysAudit}
                onChange={(e) => setForm({ ...form, retentionDaysAudit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">الاحتفاظ بالنسخ الاحتياطية (أيام)</label>
              <input
                type="number"
                disabled={!canManage}
                value={form.retentionDaysBackups}
                onChange={(e) => setForm({ ...form, retentionDaysBackups: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-xs text-[#211D25]">
              <input
                type="checkbox"
                disabled={!canManage}
                checked={form.mfaRequiredForSensitiveRoles}
                onChange={(e) => setForm({ ...form, mfaRequiredForSensitiveRoles: e.target.checked })}
              />
              <span>إلزام المصادقة متعددة العوامل MFA للحسابات الحساسة</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#211D25]">
              <input
                type="checkbox"
                disabled={!canManage}
                checked={form.requirePreviewBeforePublish}
                onChange={(e) => setForm({ ...form, requirePreviewBeforePublish: e.target.checked })}
              />
              <span>منع نشر تعديلات صفحات CMS قبل المعاينة والتأكيد</span>
            </label>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#211D25] mb-2">أسعار الصرف المرجعية للتقارير</h4>
            <div className="divide-y divide-[#EEE2DF] text-xs">
              {form.exchangeRates.map((rate) => (
                <div key={rate.currency} className="py-2 flex items-center justify-between">
                  <span className="font-bold">{rate.currency}</span>
                  <span className="tabular-nums">1 {rate.currency} = {rate.rateToUSD} USD</span>
                  <span className="text-[#6A5866]">{rate.referenceDate} · {rate.source}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#211D25] mb-1">تخصيص مراحل متابعة العملاء (CRM)</h3>
            <p className="text-xs text-[#6A5866] mb-3">مرحلة واحدة في كل سطر حسب الترتيب المطلوب</p>
            <textarea
              rows={10}
              disabled={!canManage}
              value={stagesText}
              onChange={(e) => setStagesText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
          </div>
          {canManage && (
            <button type="submit" className="w-full py-2.5 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-sm font-medium">
              حفظ الإعدادات
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
