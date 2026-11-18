import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Globe,
  History,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { hubApi, type BootstrapPayload } from '../lib/api';
import { hasPermission } from '../shared/domain';
import type { CmsArticle, CmsPageSection, CmsSectionType, PortfolioProject, ServiceOffering } from '../shared/types';
import { ConfirmModal, SafeImage, SectionHeader, StatusText, formatIsoShort } from './ui/Primitives';

type CmsTab = 'pages' | 'articles' | 'projects' | 'services' | 'seo';

const SECTION_TEMPLATES: Array<{ type: CmsSectionType; label: string; defaultTitle: string; defaultBody: string }> = [
  { type: 'hero', label: 'قسم رئيسي Hero', defaultTitle: 'عنوان رئيسي جديد', defaultBody: 'وصف تعريفي موجز لقسم البداية.' },
  { type: 'stats', label: 'شريط إحصائيات', defaultTitle: 'إحصائيات موثقة', defaultBody: 'أرقام قياس رئيسية.' },
  { type: 'services_grid', label: 'بطاقات الخدمات', defaultTitle: 'خدماتنا الهندسية', defaultBody: 'عرض الخدمات المنشورة تلقائياً.' },
  { type: 'portfolio_showcase', label: 'معرض المشاريع', defaultTitle: 'أبرز المشاريع', defaultBody: 'عرض المشاريع المنشورة من المعرض.' },
  { type: 'faq', label: 'الأسئلة الشائعة', defaultTitle: 'الأسئلة الشائعة', defaultBody: 'إجابات وافية لأسئلة العملاء.' },
  { type: 'cta', label: 'دعوة لاتخاذ إجراء CTA', defaultTitle: 'هل أنت مستعد لبدء مشروعك؟', defaultBody: 'تواصل مع فريقنا الهندسي اليوم.' },
  { type: 'rich_text', label: 'محتوى نصي منسق', defaultTitle: 'قسم تعريفي', defaultBody: 'فقرة نصية قابلة للتحرير المباشر.' },
];

export function CmsHubView({
  data,
  onRefresh,
  onNotify,
  onOpenPublicSite,
}: {
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string, tone?: 'success' | 'error') => void;
  onOpenPublicSite: () => void;
}) {
  const [activeTab, setActiveTab] = useState<CmsTab>('pages');

  // Permissions
  const canEdit = hasPermission(data.currentUser, 'cms.edit');
  const canPublish = hasPermission(data.currentUser, 'cms.publish');
  const canDelete = hasPermission(data.currentUser, 'cms.delete');

  // --- Visual Page Editor State ---
  const [selectedPageId, setSelectedPageId] = useState(data.pages[0]?.id || '');
  const activePage = data.pages.find((p) => p.id === selectedPageId) || data.pages[0];
  const [draftSections, setDraftSections] = useState<CmsPageSection[]>(activePage?.draftSections || []);
  const [pageSeoTitle, setPageSeoTitle] = useState(activePage?.seoTitle || '');
  const [pageSeoDesc, setPageSeoDesc] = useState(activePage?.seoDescription || '');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewVerified, setPreviewVerified] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [newPageForm, setNewPageForm] = useState({ open: false, name: '', slug: '', title: '' });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activePage) {
      setDraftSections(JSON.parse(JSON.stringify(activePage.draftSections)));
      setPageSeoTitle(activePage.seoTitle);
      setPageSeoDesc(activePage.seoDescription);
      setPreviewVerified(false);
    }
  }, [activePage?.id, activePage?.updatedAt]);

  // --- Article Form State ---
  const [articleForm, setArticleForm] = useState<Partial<CmsArticle> | null>(null);
  // --- Project Form State ---
  const [projectForm, setProjectForm] = useState<Partial<PortfolioProject> | null>(null);
  // --- Service Form State ---
  const [serviceForm, setServiceForm] = useState<Partial<ServiceOffering> | null>(null);
  // --- Website Settings & Redirects ---
  const [siteForm, setSiteForm] = useState(data.websiteSettings);
  const [redirectForm, setRedirectForm] = useState({ fromPath: '', toPath: '', statusCode: 301 as 301 | 302 });

  useEffect(() => {
    setSiteForm(data.websiteSettings);
  }, [data.websiteSettings]);

  // Visual Page Editor Handlers
  function addSection(tpl: (typeof SECTION_TEMPLATES)[number]) {
    const next: CmsPageSection = {
      id: `sec-${Date.now()}`,
      type: tpl.type,
      title: tpl.defaultTitle,
      subtitle: 'عنوان فرعي قابل للتعديل',
      body: tpl.defaultBody,
      ctaLabel: tpl.type === 'hero' || tpl.type === 'cta' ? 'طلب عرض مشروع' : undefined,
      ctaHref: tpl.type === 'hero' || tpl.type === 'cta' ? '#request-project' : undefined,
      imageUrl: tpl.type === 'hero' ? '/src/assets/images/kayan_hero_studio_1794962896296.jpg' : undefined,
      visible: true,
      templateVariant: 'editorial',
      items:
        tpl.type === 'stats'
          ? [{ label: 'مشاريع منجزة', value: '6+', description: 'أنظمة إنتاجية' }]
          : tpl.type === 'faq'
            ? [{ label: 'سؤال شائع', value: 'إجابة موجزة', description: 'تفاصيل التوضيح للعميل.' }]
            : undefined,
    };
    setDraftSections((prev) => [...prev, next]);
    setPreviewVerified(false);
  }

  function moveSection(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= draftSections.length) return;
    const copy = [...draftSections];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    setDraftSections(copy);
    setPreviewVerified(false);
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const copy = [...draftSections];
    const [moved] = copy.splice(dragIndex, 1);
    copy.splice(targetIndex, 0, moved);
    setDraftSections(copy);
    setDragIndex(null);
    setPreviewVerified(false);
  }

  function updateSectionField(index: number, patch: Partial<CmsPageSection>) {
    setDraftSections((prev) => prev.map((sec, idx) => (idx === index ? { ...sec, ...patch } : sec)));
    setPreviewVerified(false);
  }

  function removeSection(index: number) {
    setDraftSections((prev) => prev.filter((_, idx) => idx !== index));
    setPreviewVerified(false);
  }

  async function saveDraft() {
    if (!activePage) return;
    try {
      await hubApi.savePageDraft(activePage.id, {
        seoTitle: pageSeoTitle,
        seoDescription: pageSeoDesc,
        draftSections,
      });
      await onRefresh();
      onNotify(`تم حفظ مسودة صفحة (${activePage.name}) بنجاح.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ المسودة', 'error');
    }
  }

  async function publishCurrentPage() {
    if (!activePage) return;
    try {
      await hubApi.savePageDraft(activePage.id, {
        seoTitle: pageSeoTitle,
        seoDescription: pageSeoDesc,
        draftSections,
      });
      await hubApi.publishPage(activePage.id, 'نشر مباشر بعد المعاينة من المحرر المرئي');
      await onRefresh();
      setConfirmPublishOpen(false);
      onNotify(`تم نشر صفحة (${activePage.name}) وظهورها فوراً في الموقع العام.`);
    } catch (err) {
      setConfirmPublishOpen(false);
      onNotify(err instanceof Error ? err.message : 'تعذر نشر الصفحة', 'error');
    }
  }

  async function restoreVersion(versionNumber: number) {
    if (!activePage) return;
    try {
      await hubApi.restorePageVersion(activePage.id, versionNumber);
      await onRefresh();
      onNotify(`تمت استعادة الإصدار #${versionNumber} لصفحة (${activePage.name}).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذرت استعادة النسخة', 'error');
    }
  }

  async function handleCreatePage(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await hubApi.createPage(newPageForm);
      setNewPageForm({ open: false, name: '', slug: '', title: '' });
      await onRefresh();
      setSelectedPageId(created.id);
      onNotify(`تم إنشاء الصفحة الجديدة (${created.name}).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر إنشاء الصفحة', 'error');
    }
  }

  // Articles / Projects / Services / Settings handlers
  async function handleSaveArticle(e: React.FormEvent) {
    e.preventDefault();
    if (!articleForm) return;
    try {
      await hubApi.saveArticle(articleForm);
      setArticleForm(null);
      await onRefresh();
      onNotify('تم حفظ المقال بنجاح.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ المقال', 'error');
    }
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectForm) return;
    try {
      await hubApi.saveProject(projectForm);
      setProjectForm(null);
      await onRefresh();
      onNotify('تم حفظ المشروع في معرض الأعمال.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ المشروع', 'error');
    }
  }

  async function handleSaveService(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceForm) return;
    try {
      await hubApi.saveService(serviceForm);
      setServiceForm(null);
      await onRefresh();
      onNotify('تم حفظ الخدمة بنجاح.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ الخدمة', 'error');
    }
  }

  async function handleSaveSiteSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await hubApi.updateWebsiteSettings(siteForm);
      await onRefresh();
      onNotify('تم تحديث إعدادات الموقع العام وSEO.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر تحديث الإعدادات', 'error');
    }
  }

  async function handleAddRedirect(e: React.FormEvent) {
    e.preventDefault();
    try {
      await hubApi.addRedirect({ ...redirectForm, active: true });
      setRedirectForm({ fromPath: '', toPath: '', statusCode: 301 });
      await onRefresh();
      onNotify('تمت إضافة قاعدة التوجيه Redirect بنجاح.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذرت إضافة التحويل', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="إدارة الموقع الرسمي (CMS)"
        subtitle="إدارة كاملة لصفحات الموقع والمحرر المرئي والمقالات ومعرض الأعمال والخدمات وSEO دون تعديل أي أكواد."
        action={
          <button
            type="button"
            onClick={onOpenPublicSite}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#211D25] hover:bg-[#423441] text-white text-sm font-medium whitespace-nowrap"
          >
            <Globe className="w-4 h-4" />
            <span>فتح الموقع العام المباشر</span>
          </button>
        }
      />

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-[#EEE2DF] rounded-xl w-fit">
        {[
          { id: 'pages', label: 'الصفحات والمحرر المرئي' },
          { id: 'articles', label: `المقالات (${data.articles.length})` },
          { id: 'projects', label: `معرض الأعمال (${data.projects.length})` },
          { id: 'services', label: `الخدمات (${data.services.length})` },
          { id: 'seo', label: 'إعدادات الموقع وSEO' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as CmsTab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-[#211D25]' : 'text-[#423441] hover:text-[#211D25]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Visual Page Editor */}
      {activeTab === 'pages' && activePage && (
        <div className="space-y-5">
          <div className="bg-white border border-[#D8C7CD] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="page-selector" className="text-xs font-medium text-[#423441]">
                الصفحة:
              </label>
              <select
                id="page-selector"
                value={activePage.id}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white font-medium text-[#211D25]"
              >
                {data.pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setNewPageForm({ ...newPageForm, open: !newPageForm.open })}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs font-medium text-[#211D25] hover:bg-[#EEE2DF]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>صفحة جديدة</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode(!previewMode);
                  setPreviewVerified(true);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap ${
                  previewMode
                    ? 'bg-[#211D25] text-white border-[#211D25]'
                    : 'border-[#C5AEB5] text-[#211D25] hover:bg-[#EEE2DF]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{previewMode ? 'العودة للتحرير' : 'معاينة قبل النشر'}</span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#705267] text-[#705267] hover:bg-[#EEE2DF] text-xs font-medium whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ مسودة</span>
                </button>
              )}

              {canPublish && (
                <button
                  type="button"
                  onClick={() => {
                    if (data.orgSettings.requirePreviewBeforePublish && !previewVerified) {
                      setPreviewMode(true);
                      setPreviewVerified(true);
                      onNotify('تم فتح المعاينة أولاً؛ راجع التغييرات ثم اضغط "نشر التعديلات".');
                      return;
                    }
                    setConfirmPublishOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-xs font-medium whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>نشر التعديلات</span>
                </button>
              )}
            </div>
          </div>

          {newPageForm.open && (
            <form onSubmit={handleCreatePage} className="bg-white border border-[#705267] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">اسم الصفحة</label>
                <input
                  required
                  value={newPageForm.name}
                  onChange={(e) => setNewPageForm({ ...newPageForm, name: e.target.value })}
                  placeholder="صفحة الشركاء"
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">الرابط Slug</label>
                <input
                  required
                  value={newPageForm.slug}
                  onChange={(e) => setNewPageForm({ ...newPageForm, slug: e.target.value })}
                  placeholder="/partners"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">العنوان الرئيسي</label>
                <input
                  required
                  value={newPageForm.title}
                  onChange={(e) => setNewPageForm({ ...newPageForm, title: e.target.value })}
                  placeholder="شركاء النجاح في كيان سوفت"
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-sm font-medium">
                إنشاء الصفحة
              </button>
            </form>
          )}

          {previewMode ? (
            <div className="bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-[#EEE2DF]">
                <div>
                  <h3 className="text-base font-bold text-[#211D25]">معاينة المسودة: {activePage.name}</h3>
                  <p className="text-xs text-[#6A5866]">تم منع أي HTML أو JavaScript غير آمن تلقائياً</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-[#EEE2DF] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs ${
                      previewDevice === 'desktop' ? 'bg-white text-[#211D25] font-medium' : 'text-[#423441]'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>حاسوب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs ${
                      previewDevice === 'mobile' ? 'bg-white text-[#211D25] font-medium' : 'text-[#423441]'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>هاتف</span>
                  </button>
                </div>
              </div>

              <div
                className={`mx-auto border border-[#C5AEB5] rounded-xl overflow-hidden bg-[#F6F1EF] transition-all ${
                  previewDevice === 'mobile' ? 'max-w-[390px]' : 'w-full'
                }`}
              >
                <div className="p-6 space-y-6">
                  {draftSections
                    .filter((s) => s.visible)
                    .map((sec) => (
                      <div key={sec.id} className="bg-white border border-[#D8C7CD] rounded-xl p-5">
                        {sec.subtitle && <p className="text-xs text-[#705267] font-medium mb-1">{sec.subtitle}</p>}
                        <h4 className="text-lg font-bold text-[#211D25]">{sec.title}</h4>
                        {sec.body && <p className="text-sm text-[#423441] mt-2 leading-relaxed">{sec.body}</p>}
                        {sec.imageUrl && (
                          <SafeImage
                            src={sec.imageUrl}
                            alt={sec.title}
                            className="w-full h-48 object-cover rounded-lg mt-4"
                          />
                        )}
                        {sec.ctaLabel && (
                          <div className="mt-4">
                            <span className="inline-block px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium">
                              {sec.ctaLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Sections Builder */}
              <div className="xl:col-span-8 space-y-4">
                {draftSections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    draggable={canEdit}
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                    className={`bg-white border rounded-xl p-5 space-y-4 ${
                      sec.visible ? 'border-[#D8C7CD]' : 'border-dashed border-[#C5AEB5] opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EEE2DF]">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#705267]">
                        <span>{String(idx + 1).padStart(2, '0')}.</span>
                        <span>{SECTION_TEMPLATES.find((t) => t.type === sec.type)?.label || sec.type}</span>
                        {!sec.visible && <span className="text-[#9A5B13]">· مخفي</span>}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveSection(idx, -1)}
                            disabled={idx === 0}
                            aria-label="تحريك القسم للأعلى"
                            className="p-1.5 rounded border border-[#D8C7CD] hover:bg-[#EEE2DF] disabled:opacity-40"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(idx, 1)}
                            disabled={idx === draftSections.length - 1}
                            aria-label="تحريك القسم للأسفل"
                            className="p-1.5 rounded border border-[#D8C7CD] hover:bg-[#EEE2DF] disabled:opacity-40"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSectionField(idx, { visible: !sec.visible })}
                            aria-label={sec.visible ? 'إخفاء القسم' : 'إظهار القسم'}
                            className="p-1.5 rounded border border-[#D8C7CD] hover:bg-[#EEE2DF]"
                          >
                            {sec.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSection(idx)}
                            aria-label="حذف القسم"
                            className="p-1.5 rounded border border-[#FECDCA] text-[#B42318] hover:bg-[#FEF3F2]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#423441] mb-1">العنوان</label>
                        <input
                          disabled={!canEdit}
                          value={sec.title}
                          onChange={(e) => updateSectionField(idx, { title: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#423441] mb-1">العنوان الفرعي</label>
                        <input
                          disabled={!canEdit}
                          value={sec.subtitle || ''}
                          onChange={(e) => updateSectionField(idx, { subtitle: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                        />
                      </div>
                    </div>

                    {sec.body !== undefined && (
                      <div>
                        <label className="block text-xs font-medium text-[#423441] mb-1">النص</label>
                        <textarea
                          rows={2}
                          disabled={!canEdit}
                          value={sec.body}
                          onChange={(e) => updateSectionField(idx, { body: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                        />
                      </div>
                    )}

                    {(sec.type === 'hero' || sec.type === 'cta') && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#423441] mb-1">نص الزر</label>
                          <input
                            disabled={!canEdit}
                            value={sec.ctaLabel || ''}
                            onChange={(e) => updateSectionField(idx, { ctaLabel: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#423441] mb-1">رابط الزر</label>
                          <input
                            disabled={!canEdit}
                            dir="ltr"
                            value={sec.ctaHref || ''}
                            onChange={(e) => updateSectionField(idx, { ctaHref: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                          />
                        </div>
                        {sec.type === 'hero' && (
                          <div>
                            <label className="block text-xs font-medium text-[#423441] mb-1">صورة القسم</label>
                            <select
                              disabled={!canEdit}
                              value={sec.imageUrl || ''}
                              onChange={(e) => updateSectionField(idx, { imageUrl: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
                            >
                              {data.media
                                .filter((m) => m.mimeType.startsWith('image/'))
                                .map((m) => (
                                  <option key={m.id} value={m.url}>
                                    {m.fileName}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right Sidebar: Add Section Templates + SEO + Version History */}
              <div className="xl:col-span-4 space-y-5">
                {canEdit && (
                  <div className="bg-white border border-[#D8C7CD] rounded-xl p-5">
                    <h4 className="text-sm font-bold text-[#211D25] mb-3">إضافة قسم من القوالب الجاهزة</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {SECTION_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.type}
                          type="button"
                          onClick={() => addSection(tpl)}
                          className="text-right px-3 py-2 rounded-lg border border-[#D8C7CD] hover:border-[#705267] hover:bg-[#EEE2DF]/50 text-xs font-medium text-[#211D25] flex items-center justify-between"
                        >
                          <span>{tpl.label}</span>
                          <Plus className="w-3.5 h-3.5 text-[#705267]" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-[#D8C7CD] rounded-xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-[#211D25]">إعدادات SEO للصفحة</h4>
                  <div>
                    <label className="block text-xs text-[#423441] mb-1">Meta Title</label>
                    <input
                      disabled={!canEdit}
                      value={pageSeoTitle}
                      onChange={(e) => setPageSeoTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#423441] mb-1">Meta Description</label>
                    <textarea
                      rows={2}
                      disabled={!canEdit}
                      value={pageSeoDesc}
                      onChange={(e) => setPageSeoDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs"
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-[#F6F1EF] text-xs">
                    <div className="text-[11px] text-[#6A5866]">معاينة نتيجة البحث</div>
                    <div className="font-bold text-[#423441] mt-1">{pageSeoTitle || activePage.title}</div>
                    <div className="text-[11px] text-[#156E3F]" dir="ltr">
                      kayansoft.sa{activePage.slug}
                    </div>
                    <div className="text-[11px] text-[#6A5866] mt-0.5 line-clamp-2">{pageSeoDesc}</div>
                  </div>
                </div>

                <div className="bg-white border border-[#D8C7CD] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-[#705267]" />
                    <h4 className="text-sm font-bold text-[#211D25]">سجل النسخ والإصدارات</h4>
                  </div>
                  {activePage.versions.length === 0 ? (
                    <p className="text-xs text-[#6A5866]">لا توجد إصدارات سابقة محفوظة بعد.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {activePage.versions.map((ver) => (
                        <div key={ver.versionNumber} className="p-3 rounded-lg bg-[#F6F1EF] flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#211D25]">الإصدار #{ver.versionNumber}</div>
                            <div className="text-[11px] text-[#6A5866] truncate">
                              {ver.savedBy} · {formatIsoShort(ver.savedAt)}
                            </div>
                          </div>
                          {canPublish && (
                            <button
                              type="button"
                              onClick={() => restoreVersion(ver.versionNumber)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#C5AEB5] bg-white hover:bg-[#EEE2DF] text-[11px] font-medium whitespace-nowrap"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>استعادة</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Articles */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-[#211D25]">إدارة المقالات والمنشورات</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  setArticleForm({
                    title: '',
                    slug: '',
                    excerpt: '',
                    content: '',
                    category: 'هندسة البرمجيات',
                    tags: [],
                    status: 'draft',
                    coverImage: data.media[0]?.url || '/src/assets/images/article_architecture_cover_1794962895677.jpg',
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>مقال جديد</span>
              </button>
            )}
          </div>

          {articleForm && (
            <form onSubmit={handleSaveArticle} className="bg-white border border-[#705267] rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">عنوان المقال</label>
                  <input
                    required
                    value={articleForm.title || ''}
                    onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">التصنيف</label>
                  <input
                    value={articleForm.category || ''}
                    onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">الحالة</label>
                  <select
                    value={articleForm.status || 'draft'}
                    onChange={(e) => setArticleForm({ ...articleForm, status: e.target.value as CmsArticle['status'] })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
                  >
                    <option value="draft">مسودة</option>
                    <option value="in_review">قيد المراجعة</option>
                    <option value="scheduled" disabled={!canPublish}>مجدول</option>
                    <option value="published" disabled={!canPublish}>منشور</option>
                    <option value="archived">مؤرشف</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">صورة الغلاف (من مكتبة الوسائط)</label>
                  <select
                    value={articleForm.coverImage || ''}
                    onChange={(e) => setArticleForm({ ...articleForm, coverImage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
                  >
                    {data.media
                      .filter((m) => m.mimeType.startsWith('image/'))
                      .map((m) => (
                        <option key={m.id} value={m.url}>
                          {m.fileName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">ملخص المقال</label>
                <input
                  value={articleForm.excerpt || ''}
                  onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">محتوى المقال</label>
                <textarea
                  rows={4}
                  required
                  value={articleForm.content || ''}
                  onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setArticleForm(null)}
                  className="px-4 py-2 rounded-lg border border-[#C5AEB5] text-xs"
                >
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium">
                  حفظ المقال
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-[#D8C7CD] rounded-xl divide-y divide-[#EEE2DF]">
            {data.articles.map((art) => (
              <div key={art.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <SafeImage src={art.coverImage} alt={art.title} className="w-20 h-14 object-cover rounded-lg shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#211D25] truncate">{art.title}</h4>
                    <p className="text-xs text-[#6A5866] mt-0.5">
                      {art.category} · {art.authorName} · {art.views.toLocaleString('en-US')} مشاهدة · نسخة #{art.revisionCount}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusText
                    tone={art.status === 'published' ? 'success' : art.status === 'archived' ? 'neutral' : 'warning'}
                    label={
                      art.status === 'published'
                        ? 'منشور'
                        : art.status === 'draft'
                          ? 'مسودة'
                          : art.status === 'in_review'
                            ? 'قيد المراجعة'
                            : art.status === 'scheduled'
                              ? 'مجدول'
                              : 'مؤرشف'
                    }
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setArticleForm(art)}
                      className="px-3 py-1.5 rounded-lg border border-[#C5AEB5] text-xs hover:bg-[#EEE2DF]"
                    >
                      تعديل
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={async () => {
                        await hubApi.deleteArticle(art.id);
                        await onRefresh();
                        onNotify('تم حذف المقال.');
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#FECDCA] text-[#B42318] text-xs hover:bg-[#FEF3F2]"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Portfolio Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-[#211D25]">إدارة معرض أعمال المؤسسة</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  setProjectForm({
                    name: '',
                    category: 'الأنظمة السحابية',
                    year: '2026',
                    shortDescription: '',
                    problemSolved: '',
                    solutionProvided: '',
                    technologies: ['React', 'TypeScript'],
                    coverImage: '/src/assets/images/project_krotak_showcase_1794962892852.jpg',
                    clientName: '',
                    showClientName: true,
                    featured: false,
                    published: canPublish,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مشروع للمعرض</span>
              </button>
            )}
          </div>

          {projectForm && (
            <form onSubmit={handleSaveProject} className="bg-white border border-[#705267] rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">اسم المشروع</label>
                  <input
                    required
                    value={projectForm.name || ''}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">التصنيف</label>
                  <input
                    value={projectForm.category || ''}
                    onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">سنة التنفيذ</label>
                  <input
                    value={projectForm.year || '2026'}
                    onChange={(e) => setProjectForm({ ...projectForm, year: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">المشكلة التي يعالجها المشروع</label>
                  <textarea
                    rows={2}
                    value={projectForm.problemSolved || ''}
                    onChange={(e) => setProjectForm({ ...projectForm, problemSolved: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">الحل المقدم</label>
                  <textarea
                    rows={2}
                    value={projectForm.solutionProvided || ''}
                    onChange={(e) => setProjectForm({ ...projectForm, solutionProvided: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">صورة الغلاف</label>
                  <select
                    value={projectForm.coverImage || ''}
                    onChange={(e) => setProjectForm({ ...projectForm, coverImage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
                  >
                    {data.media
                      .filter((m) => m.mimeType.startsWith('image/'))
                      .map((m) => (
                        <option key={m.id} value={m.url}>
                          {m.fileName}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex items-center gap-6 pt-5">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(projectForm.published)}
                      disabled={!canPublish}
                      onChange={(e) => setProjectForm({ ...projectForm, published: e.target.checked })}
                    />
                    <span>منشور في الموقع العام</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(projectForm.featured)}
                      onChange={(e) => setProjectForm({ ...projectForm, featured: e.target.checked })}
                    />
                    <span>مشروع مميز</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setProjectForm(null)} className="px-4 py-2 rounded-lg border border-[#C5AEB5] text-xs">
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium">
                  حفظ المشروع
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.projects.map((prj) => (
              <div key={prj.id} className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden flex flex-col justify-between">
                <div>
                  <SafeImage src={prj.coverImage} alt={prj.name} className="w-full h-40 object-cover" />
                  <div className="p-4">
                    <div className="text-[11px] text-[#6A5866]">
                      {prj.category} · {prj.year} {prj.featured ? '· مميز' : ''}
                    </div>
                    <h4 className="font-bold text-sm text-[#211D25] mt-1">{prj.name}</h4>
                    <p className="text-xs text-[#423441] mt-1.5 line-clamp-2">{prj.shortDescription}</p>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-[#EEE2DF] flex items-center justify-between">
                  <StatusText tone={prj.published ? 'success' : 'neutral'} label={prj.published ? 'منشور' : 'مسودة'} />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setProjectForm(prj)}
                      className="text-xs font-medium text-[#705267] hover:text-[#211D25]"
                    >
                      تعديل
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Services */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-[#211D25]">إدارة الخدمات المعروضة بالموقع</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  setServiceForm({ name: '', shortDescription: '', startingPrice: '', linkedFormTag: '', published: true })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة خدمة</span>
              </button>
            )}
          </div>

          {serviceForm && (
            <form onSubmit={handleSaveService} className="bg-white border border-[#705267] rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">اسم الخدمة</label>
                  <input
                    required
                    value={serviceForm.name || ''}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">التسعير الاسترشادي (اختياري)</label>
                  <input
                    value={serviceForm.startingPrice || ''}
                    onChange={(e) => setServiceForm({ ...serviceForm, startingPrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">وصف الخدمة</label>
                <textarea
                  rows={2}
                  value={serviceForm.shortDescription || ''}
                  onChange={(e) => setServiceForm({ ...serviceForm, shortDescription: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setServiceForm(null)} className="px-4 py-2 rounded-lg border border-[#C5AEB5] text-xs">
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium">
                  حفظ الخدمة
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.services.map((srv) => (
              <div key={srv.id} className="bg-white border border-[#D8C7CD] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-base text-[#211D25]">{srv.name}</h4>
                    <StatusText tone={srv.published ? 'success' : 'neutral'} label={srv.published ? 'منشورة' : 'مخفية'} />
                  </div>
                  <p className="text-xs text-[#423441] mt-2">{srv.shortDescription}</p>
                  {srv.startingPrice && <p className="text-xs font-bold text-[#705267] mt-2">{srv.startingPrice}</p>}
                </div>
                {canEdit && (
                  <div className="mt-4 pt-3 border-t border-[#EEE2DF] flex justify-end">
                    <button
                      type="button"
                      onClick={() => setServiceForm(srv)}
                      className="text-xs font-medium text-[#705267] hover:text-[#211D25]"
                    >
                      تعديل الخدمة
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Website Settings & SEO Redirects */}
      {activeTab === 'seo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSaveSiteSettings} className="lg:col-span-7 bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#211D25]">إعدادات الموقع العام وبيانات التواصل</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">اسم المؤسسة</label>
                <input
                  disabled={!canPublish}
                  value={siteForm.orgName}
                  onChange={(e) => setSiteForm({ ...siteForm, orgName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">البريد الرسمي</label>
                <input
                  disabled={!canPublish}
                  dir="ltr"
                  value={siteForm.email}
                  onChange={(e) => setSiteForm({ ...siteForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">رقم الهاتف</label>
                <input
                  disabled={!canPublish}
                  dir="ltr"
                  value={siteForm.phone}
                  onChange={(e) => setSiteForm({ ...siteForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">رقم واتساب الطلبات</label>
                <input
                  disabled={!canPublish}
                  dir="ltr"
                  value={siteForm.whatsappNumber}
                  onChange={(e) => setSiteForm({ ...siteForm, whatsappNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">العنوان</label>
              <input
                disabled={!canPublish}
                value={siteForm.address}
                onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">ملف Robots.txt</label>
              <textarea
                rows={3}
                dir="ltr"
                disabled={!canPublish}
                value={siteForm.robotsTxt}
                onChange={(e) => setSiteForm({ ...siteForm, robotsTxt: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs font-mono-nums"
              />
            </div>
            {canPublish && (
              <div className="flex justify-between items-center pt-2">
                <a
                  href="/api/public/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#705267] hover:underline"
                >
                  معاينة Sitemap.xml المولّد تلقائياً
                </a>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#705267] text-white text-xs font-medium">
                  حفظ ونشر الإعدادات
                </button>
              </div>
            )}
          </form>

          <div className="lg:col-span-5 bg-white border border-[#D8C7CD] rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#211D25]">التحويلات الدائمة والمؤقتة (Redirects)</h3>
            <div className="divide-y divide-[#EEE2DF] text-xs">
              {data.redirects.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between" dir="ltr">
                  <span className="font-mono-nums text-[#211D25]">
                    {r.fromPath} → {r.toPath}
                  </span>
                  <span className="text-[#6A5866]">{r.statusCode}</span>
                </div>
              ))}
            </div>
            {canPublish && (
              <form onSubmit={handleAddRedirect} className="pt-3 border-t border-[#EEE2DF] space-y-2.5">
                <input
                  required
                  dir="ltr"
                  placeholder="/old-path"
                  value={redirectForm.fromPath}
                  onChange={(e) => setRedirectForm({ ...redirectForm, fromPath: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs"
                />
                <input
                  required
                  dir="ltr"
                  placeholder="/new-path"
                  value={redirectForm.toPath}
                  onChange={(e) => setRedirectForm({ ...redirectForm, toPath: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-xs"
                />
                <button type="submit" className="w-full py-2 rounded-lg bg-[#211D25] text-white text-xs font-medium">
                  إضافة تحويل SEO
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmPublishOpen}
        title="تأكيد نشر التعديلات على الموقع الرسمي"
        description={`سيتم حفظ نسخة احتياطية في سجل الإصدارات ونشر المسودة الحالية لصفحة "${activePage?.name}" على الموقع العام فوراً.`}
        confirmLabel="نشر الآن"
        onConfirm={publishCurrentPage}
        onCancel={() => setConfirmPublishOpen(false)}
      />
    </div>
  );
}
