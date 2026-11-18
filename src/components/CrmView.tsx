import React, { useState } from 'react';
import { CheckSquare, Plus, Square } from 'lucide-react';
import { hubApi, type BootstrapPayload } from '../lib/api';
import { hasPermission } from '../shared/domain';
import type { CrmLead } from '../shared/types';
import { formatIsoShort, SectionHeader, StatusText } from './ui/Primitives';

export function CrmView({
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
  const [viewMode, setViewMode] = useState<'list' | 'pipeline' | 'tasks'>('list');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(data.leads[0]?.id || '');
  const [activityForm, setActivityForm] = useState({ type: 'note' as 'note' | 'call' | 'meeting' | 'quote', summary: '' });
  const [quoteInput, setQuoteInput] = useState('');
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '2026-11-20' });
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [manualLead, setManualLead] = useState({
    name: '',
    organization: '',
    email: '',
    phone: '',
    requestedService: data.services[0]?.name || 'تطوير منصة سحابية',
    details: '',
  });

  const canManage = hasPermission(data.currentUser, 'crm.manage');
  const stages = data.orgSettings.crmStages;

  const filteredLeads = data.leads.filter((l) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.organization.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.phone.includes(q);
    const matchStage = stageFilter === 'all' || l.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const selected: CrmLead | undefined =
    filteredLeads.find((l) => l.id === selectedLeadId) || filteredLeads[0];

  async function handleUpdateLead(patch: Parameters<typeof hubApi.updateLead>[1]) {
    if (!selected) return;
    try {
      await hubApi.updateLead(selected.id, patch);
      await onRefresh();
      onNotify('تم تحديث ملف العميل وتسجيل النشاط.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر تحديث العميل', 'error');
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !activityForm.summary.trim()) return;
    await handleUpdateLead({
      activityType: activityForm.type,
      activitySummary: activityForm.summary,
      quoteAmount: activityForm.type === 'quote' && quoteInput ? quoteInput : undefined,
    });
    setActivityForm({ ...activityForm, summary: '' });
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !taskForm.title.trim()) return;
    try {
      await hubApi.addTask({ leadId: selected.id, title: taskForm.title, dueDate: taskForm.dueDate });
      setTaskForm({ ...taskForm, title: '' });
      await onRefresh();
      onNotify('تمت إضافة مهمة المتابعة بنجاح.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذرت إضافة المهمة', 'error');
    }
  }

  async function handleCreateManualLead(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await hubApi.submitPublicLead({ ...manualLead, source: 'manual' });
      setNewLeadOpen(false);
      setManualLead({ name: '', organization: '', email: '', phone: '', requestedService: 'تطوير منصة سحابية', details: '' });
      await onRefresh();
      setSelectedLeadId(created.id);
      onNotify('تم حفظ العميل الجديد في قاعدة البيانات الدائمة.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ العميل', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="إدارة العملاء والطلبات (CRM)"
        subtitle="استقبال طلبات المشاريع من الموقع وحفظها الدائم مع مراحل المتابعة والمهام وعروض الأسعار."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-[#EEE2DF] rounded-lg">
              {[
                { id: 'list', label: 'قائمة وتفاصيل' },
                { id: 'pipeline', label: 'مراحل المتابعة' },
                { id: 'tasks', label: `المهام (${data.tasks.filter((t) => !t.completed).length})` },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id as 'list' | 'pipeline' | 'tasks')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                    viewMode === m.id ? 'bg-white text-[#211D25]' : 'text-[#423441]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setNewLeadOpen(!newLeadOpen)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>إدخال عميل يدوي</span>
              </button>
            )}
          </div>
        }
      />

      {newLeadOpen && (
        <form onSubmit={handleCreateManualLead} className="bg-white border border-[#705267] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-[#211D25]">تسجيل عميل محتمل يدوياً</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              required
              placeholder="الاسم الكامل"
              value={manualLead.name}
              onChange={(e) => setManualLead({ ...manualLead, name: e.target.value })}
              className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
            <input
              placeholder="اسم المؤسسة"
              value={manualLead.organization}
              onChange={(e) => setManualLead({ ...manualLead, organization: e.target.value })}
              className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
            <input
              required
              type="email"
              dir="ltr"
              placeholder="email@company.com"
              value={manualLead.email}
              onChange={(e) => setManualLead({ ...manualLead, email: e.target.value })}
              className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
            <input
              required
              dir="ltr"
              placeholder="+9665..."
              value={manualLead.phone}
              onChange={(e) => setManualLead({ ...manualLead, phone: e.target.value })}
              className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
            />
          </div>
          <textarea
            required
            rows={2}
            placeholder="تفاصيل الطلب والمتطلبات..."
            value={manualLead.details}
            onChange={(e) => setManualLead({ ...manualLead, details: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewLeadOpen(false)} className="px-4 py-2 rounded-lg border border-[#C5AEB5] text-xs">
              إلغاء
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium">
              حفظ العميل
            </button>
          </div>
        </form>
      )}

      {viewMode === 'tasks' && (
        <div className="bg-white border border-[#D8C7CD] rounded-xl divide-y divide-[#EEE2DF]">
          {data.tasks.map((task) => (
            <div key={task.id} className="p-4 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={!canManage}
                onClick={async () => {
                  await hubApi.toggleTask(task.id);
                  await onRefresh();
                }}
                className="flex items-center gap-3 text-right"
              >
                {task.completed ? (
                  <CheckSquare className="w-5 h-5 text-[#156E3F] shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-[#705267] shrink-0" />
                )}
                <div>
                  <div className={`text-sm font-medium ${task.completed ? 'line-through text-[#6A5866]' : 'text-[#211D25]'}`}>
                    {task.title}
                  </div>
                  <div className="text-xs text-[#6A5866]">
                    {task.leadName} · المسؤول: {task.assigneeName} · الاستحقاق: <span className="tabular-nums">{task.dueDate}</span>
                  </div>
                </div>
              </button>
              <StatusText tone={task.completed ? 'success' : 'warning'} label={task.completed ? 'مكتملة' : 'قيد المتابعة'} />
            </div>
          ))}
        </div>
      )}

      {viewMode === 'pipeline' && (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-flow-col auto-cols-[260px] gap-4">
            {stages.map((stage) => {
              const items = filteredLeads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="bg-white border border-[#D8C7CD] rounded-xl p-3 flex flex-col gap-2.5 min-h-[260px]">
                  <div className="pb-2 border-b border-[#EEE2DF] flex items-center justify-between text-xs font-bold text-[#211D25]">
                    <span>{stage}</span>
                    <span className="tabular-nums text-[#705267]">{items.length}</span>
                  </div>
                  {items.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setSelectedLeadId(l.id);
                        setViewMode('list');
                      }}
                      className="text-right p-3 rounded-lg bg-[#F6F1EF] hover:bg-[#EEE2DF] border border-[#D8C7CD]"
                    >
                      <div className="font-bold text-xs text-[#211D25]">{l.name}</div>
                      <div className="text-[11px] text-[#6A5866] mt-0.5 truncate">{l.organization}</div>
                      <div className="text-[11px] text-[#705267] mt-1">{l.requestedService}</div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <select
              aria-label="تصفية حسب المرحلة"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
            >
              <option value="all">كل مراحل المتابعة ({data.leads.length})</option>
              {stages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <div className="bg-white border border-[#D8C7CD] rounded-xl divide-y divide-[#EEE2DF]">
              {filteredLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-right p-4 transition-colors ${
                    selected?.id === lead.id ? 'bg-[#EEE2DF]/70' : 'hover:bg-[#F6F1EF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#211D25]">{lead.name}</span>
                    <span className="text-[11px] text-[#705267] font-medium">{lead.stage}</span>
                  </div>
                  <div className="text-xs text-[#6A5866] mt-0.5">{lead.organization} · {lead.requestedService}</div>
                  <div className="text-[11px] text-[#6A5866] mt-1 tabular-nums">
                    {lead.createdAt.slice(0, 10)} · المسؤول: {lead.assigneeName}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            {selected ? (
              <div className="bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#EEE2DF]">
                  <div>
                    <h3 className="text-xl font-bold text-[#211D25]">{selected.name}</h3>
                    <p className="text-xs text-[#6A5866] mt-1">
                      {selected.organization} · {selected.email} · <span dir="ltr">{selected.phone}</span> · {selected.city}، {selected.country}
                    </p>
                  </div>
                  <StatusText
                    tone={selected.whatsappNotificationStatus === 'sent' ? 'success' : 'warning'}
                    label={selected.whatsappNotificationStatus === 'sent' ? 'إشعار واتساب مرسل' : 'حُفظ الطلب (إشعار واتساب معلق)'}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg bg-[#F6F1EF]">
                    <div className="text-[#6A5866]">الخدمة / المشروع المطلوب</div>
                    <div className="font-bold text-[#211D25] mt-1">{selected.requestedProject || selected.requestedService}</div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#F6F1EF]">
                    <div className="text-[#6A5866]">الميزانية والمدة المتوقعة</div>
                    <div className="font-bold text-[#211D25] mt-1">
                      {selected.expectedBudget} · {selected.expectedTimeline}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-[#423441] leading-relaxed bg-[#FAF7F6] p-4 rounded-lg border border-[#EEE2DF]">
                  {selected.details}
                </div>

                {canManage && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#423441] mb-1">مرحلة المتابعة</label>
                      <select
                        value={selected.stage}
                        onChange={(e) => handleUpdateLead({ stage: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
                      >
                        {stages.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#423441] mb-1">الموظف المسؤول</label>
                      <select
                        value={selected.assigneeId}
                        onChange={(e) => handleUpdateLead({ assigneeId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
                      >
                        {data.users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {canManage && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#EEE2DF]">
                    <form onSubmit={handleAddActivity} className="space-y-2">
                      <label className="block text-xs font-bold text-[#211D25]">تسجيل نشاط / ملاحظة / عرض سعر</label>
                      <select
                        value={activityForm.type}
                        onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as 'note' | 'call' | 'meeting' | 'quote' })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#C5AEB5] text-xs bg-white"
                      >
                        <option value="note">ملاحظة</option>
                        <option value="call">مكالمة هاتفية</option>
                        <option value="meeting">اجتماع أو استشارة</option>
                        <option value="quote">عرض سعر</option>
                      </select>
                      {activityForm.type === 'quote' && (
                        <input
                          placeholder="قيمة العرض (مثال: 15,000 USD)"
                          value={quoteInput}
                          onChange={(e) => setQuoteInput(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#C5AEB5] text-xs"
                        />
                      )}
                      <textarea
                        rows={2}
                        placeholder="تفاصيل المتابعة..."
                        value={activityForm.summary}
                        onChange={(e) => setActivityForm({ ...activityForm, summary: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#C5AEB5] text-xs"
                      />
                      <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#705267] text-white text-xs font-medium">
                        حفظ النشاط
                      </button>
                    </form>

                    <form onSubmit={handleAddTask} className="space-y-2">
                      <label className="block text-xs font-bold text-[#211D25]">جدولة مهمة متابعة</label>
                      <input
                        placeholder="عنوان المهمة..."
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#C5AEB5] text-xs"
                      />
                      <input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#C5AEB5] text-xs"
                      />
                      <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#211D25] text-white text-xs font-medium">
                        إضافة مهمة
                      </button>
                    </form>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-[#211D25] mb-3">سجل الأنشطة</h4>
                  <div className="space-y-2.5">
                    {selected.activities.map((act) => (
                      <div key={act.id} className="p-3 rounded-lg bg-[#F6F1EF] text-xs">
                        <div className="flex items-center justify-between text-[#6A5866] mb-1">
                          <span className="font-bold text-[#211D25]">{act.author}</span>
                          <span className="tabular-nums" dir="ltr">{formatIsoShort(act.createdAt)}</span>
                        </div>
                        <p className="text-[#423441]">{act.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#D8C7CD] rounded-xl p-10 text-center text-sm text-[#6A5866]">
                لا توجد طلبات مطابقة.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
