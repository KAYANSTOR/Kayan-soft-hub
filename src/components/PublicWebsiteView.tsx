import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, LayoutDashboard, X } from 'lucide-react';
import { hubApi, type PublicSitePayload } from '../lib/api';
import type { CmsArticle, PortfolioProject } from '../shared/types';
import { SafeImage } from './ui/Primitives';

export function PublicWebsiteView({
  hasAdminSession,
  onBackToAdmin,
}: {
  hasAdminSession: boolean;
  onBackToAdmin: () => void;
}) {
  const [siteData, setSiteData] = useState<PublicSitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<CmsArticle | null>(null);
  const [leadForm, setLeadForm] = useState({
    name: '',
    organization: '',
    email: '',
    phone: '',
    city: '',
    requestedService: 'هندسة وتطوير المنصات السحابية',
    expectedBudget: '10,000 - 20,000 USD',
    details: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [leadFeedback, setLeadFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    hubApi
      .getPublicSite()
      .then((res) => {
        setSiteData(res);
        if (res.services[0]?.name) {
          setLeadForm((f) => ({ ...f, requestedService: res.services[0].name }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLeadFeedback(null);
    setSubmitting(true);
    try {
      await hubApi.submitPublicLead({
        ...leadForm,
        source: 'project_request_form',
      });
      setLeadFeedback({
        ok: true,
        msg: 'تم استلام طلب مشروعك وحفظه بنجاح في منظومة كيان سوفت. سيتواصل معك الفريق المختص قريباً.',
      });
      setLeadForm({
        name: '',
        organization: '',
        email: '',
        phone: '',
        city: '',
        requestedService: siteData?.services[0]?.name || 'هندسة وتطوير المنصات السحابية',
        expectedBudget: '10,000 - 20,000 USD',
        details: '',
      });
    } catch (err) {
      setLeadFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'تعذر إرسال الطلب، يرجى التحقق من البيانات.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !siteData) {
    return (
      <div className="min-h-screen bg-[#F6F1EF] flex items-center justify-center text-sm text-[#423441]">
        جاري تحميل الموقع الرسمي لكيان سوفت...
      </div>
    );
  }

  const homePage = siteData.pages.find((p) => p.slug === '/') || siteData.pages[0];
  const heroSec = homePage?.sections.find((s) => s.type === 'hero' && s.visible);
  const statsSec = homePage?.sections.find((s) => s.type === 'stats' && s.visible);
  const servicesSec = homePage?.sections.find((s) => s.type === 'services_grid' && s.visible);
  const portfolioSec = homePage?.sections.find((s) => s.type === 'portfolio_showcase' && s.visible);
  const faqSec = homePage?.sections.find((s) => s.type === 'faq' && s.visible);
  const ctaSec = homePage?.sections.find((s) => s.type === 'cta' && s.visible);

  return (
    <div className="min-h-screen bg-[#F6F1EF] text-[#211D25]">
      {/* Admin Return Strip (only when returning from hub) */}
      <div className="bg-[#211D25] text-[#EEE2DF] px-4 py-2 text-xs flex items-center justify-between">
        <span>معاينة الموقع الرسمي الديناميكي لكيان سوفت — المحتوى مُدار بالكامل عبر Kayan Soft Hub CMS</span>
        <button
          type="button"
          onClick={onBackToAdmin}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#705267] hover:bg-[#987988] text-white font-medium whitespace-nowrap"
        >
          {hasAdminSession ? <LayoutDashboard className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          <span>{hasAdminSession ? 'العودة إلى لوحة الإدارة' : 'تسجيل دخول الإدارة'}</span>
        </button>
      </div>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-[#D8C7CD]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a href="#top" className="text-lg font-display font-bold text-[#211D25] whitespace-nowrap shrink-0">
            كيان سوفت
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#423441]" aria-label="التنقل الرئيسي">
            <a href="#services" className="hover:text-[#705267] transition-colors whitespace-nowrap shrink-0">
              الخدمات
            </a>
            <a href="#products" className="hover:text-[#705267] transition-colors whitespace-nowrap shrink-0">
              المنتجات
            </a>
            <a href="#portfolio" className="hover:text-[#705267] transition-colors whitespace-nowrap shrink-0">
              معرض الأعمال
            </a>
            <a href="#blog" className="hover:text-[#705267] transition-colors whitespace-nowrap shrink-0">
              المدونة
            </a>
            <a href="#faq" className="hover:text-[#705267] transition-colors whitespace-nowrap shrink-0">
              الأسئلة الشائعة
            </a>
          </nav>

          <div className="shrink-0">
            <a
              href="#request-project"
              className="inline-block px-4 py-2 text-xs font-medium text-white bg-[#705267] hover:bg-[#423441] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              اطلب مشروعك
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="max-w-7xl mx-auto px-6 py-12 space-y-20">
        {/* Hero Section */}
        {heroSec && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
              {heroSec.subtitle && <p className="text-sm font-medium text-[#705267]">{heroSec.subtitle}</p>}
              <h1 className="text-3xl sm:text-5xl font-bold text-[#211D25] leading-tight">{heroSec.title}</h1>
              {heroSec.body && <p className="text-base text-[#423441] leading-relaxed max-w-xl">{heroSec.body}</p>}
              {heroSec.ctaLabel && (
                <div className="pt-2">
                  <a
                    href={heroSec.ctaHref || '#request-project'}
                    className="inline-block px-6 py-3 rounded-lg bg-[#705267] hover:bg-[#423441] text-white font-medium text-sm transition-colors"
                  >
                    {heroSec.ctaLabel}
                  </a>
                </div>
              )}
            </div>
            <div className="lg:col-span-6">
              <SafeImage
                src={heroSec.imageUrl}
                alt={heroSec.title}
                className="w-full h-full min-h-[320px] max-h-[440px] object-cover rounded-xl border border-[#D8C7CD]"
              />
            </div>
          </section>
        )}

        {/* Stats Strip */}
        {statsSec && statsSec.items && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-[#D8C7CD] py-8">
            {statsSec.items.map((st, idx) => (
              <div key={idx} className="px-2">
                <div className="text-2xl font-bold text-[#211D25] font-display tabular-nums">{st.value}</div>
                <div className="text-sm font-medium text-[#705267] mt-1">{st.label}</div>
                {st.description && <div className="text-xs text-[#6A5866] mt-0.5">{st.description}</div>}
              </div>
            ))}
          </section>
        )}

        {/* Services Section */}
        {servicesSec && (
          <section id="services" className="space-y-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#211D25]">{servicesSec.title}</h2>
              {servicesSec.subtitle && <p className="text-sm text-[#6A5866] mt-2">{servicesSec.subtitle}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {siteData.services.map((srv, idx) => (
                <article key={srv.id} className="bg-white border border-[#D8C7CD] rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-medium text-[#705267] mb-2">
                      {String(idx + 1).padStart(2, '0')}. خدمة هندسية
                    </div>
                    <h3 className="text-lg font-bold text-[#211D25]">{srv.name}</h3>
                    <p className="text-sm text-[#423441] mt-2 leading-relaxed">{srv.shortDescription}</p>
                    <ul className="mt-4 space-y-1 text-xs text-[#6A5866]">
                      {srv.features.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-5 pt-4 border-t border-[#EEE2DF] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#211D25]">{srv.startingPrice || 'تسعير حسب النطاق'}</span>
                    <a
                      href="#request-project"
                      onClick={() => setLeadForm((f) => ({ ...f, requestedService: srv.name }))}
                      className="font-medium text-[#705267] hover:underline"
                    >
                      اطلب هذه الخدمة
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Marketing Products Section */}
        <section id="products" className="space-y-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#211D25]">منتجات مؤسسة كيان سوفت</h2>
            <p className="text-sm text-[#6A5866] mt-2">أنظمة برمجية متخصصة تعمل باستقلالية كاملة لخدمة القطاعات الحيوية.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {siteData.products.map((prod) => (
              <div key={prod.id} className="bg-white border border-[#D8C7CD] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-[#211D25]">{prod.name}</h3>
                  <p className="text-xs text-[#423441] mt-2 leading-relaxed">{prod.marketingTagline || prod.description}</p>
                </div>
                <a
                  href="#request-project"
                  onClick={() => setLeadForm((f) => ({ ...f, requestedService: prod.name }))}
                  className="mt-4 text-xs font-medium text-[#705267] hover:underline"
                >
                  طلب عرض أو تجربة
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Portfolio Showcase */}
        {portfolioSec && (
          <section id="portfolio" className="space-y-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#211D25]">{portfolioSec.title}</h2>
              {portfolioSec.subtitle && <p className="text-sm text-[#6A5866] mt-2">{portfolioSec.subtitle}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {siteData.projects.map((prj) => (
                <article
                  key={prj.id}
                  className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <SafeImage src={prj.coverImage} alt={prj.name} className="w-full h-48 object-cover" />
                    <div className="p-5">
                      <div className="text-xs text-[#6A5866]">
                        {prj.category} · {prj.year}
                      </div>
                      <h3 className="font-bold text-base text-[#211D25] mt-1">{prj.name}</h3>
                      <p className="text-xs text-[#423441] mt-2 leading-relaxed">{prj.shortDescription}</p>
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-[#EEE2DF] flex items-center justify-between">
                    <span className="text-[11px] text-[#6A5866]">
                      {prj.showClientName ? prj.clientName : 'عميل مؤسسي'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(prj)}
                      className="text-xs font-medium text-[#705267] hover:underline"
                    >
                      دراسة الحالة
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Blog Articles */}
        <section id="blog" className="space-y-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#211D25]">المدونة الهندسية</h2>
            <p className="text-sm text-[#6A5866] mt-2">مقالات ودراسات من واقع بناء وتشغيل أنظمة كيان سوفت.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {siteData.articles.map((art) => (
              <article key={art.id} className="bg-white border border-[#D8C7CD] rounded-xl overflow-hidden flex flex-col justify-between">
                <div>
                  <SafeImage src={art.coverImage} alt={art.title} className="w-full h-44 object-cover" />
                  <div className="p-5">
                    <div className="text-xs text-[#6A5866]">
                      {art.category} · {art.authorName}
                    </div>
                    <h3 className="font-bold text-base text-[#211D25] mt-1">{art.title}</h3>
                    <p className="text-xs text-[#423441] mt-2 line-clamp-2">{art.excerpt}</p>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-[#EEE2DF]">
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(art)}
                    className="text-xs font-medium text-[#705267] hover:underline"
                  >
                    قراءة المقال
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        {faqSec && faqSec.items && (
          <section id="faq" className="space-y-6">
            <h2 className="text-2xl font-bold text-[#211D25]">{faqSec.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {faqSec.items.map((item, idx) => (
                <div key={idx} className="bg-white border border-[#D8C7CD] rounded-xl p-5">
                  <h3 className="font-bold text-sm text-[#211D25]">{item.label}</h3>
                  <p className="text-xs text-[#423441] mt-2 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lead Request Form */}
        <section id="request-project" className="bg-[#211D25] text-[#EEE2DF] rounded-2xl p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {ctaSec?.title || 'ابدأ مشروعك البرمجي مع كيان سوفت'}
            </h2>
            <p className="text-sm text-[#C5AEB5] leading-relaxed">
              {ctaSec?.body || 'أرسل متطلبات مشروعك ليتم تسجيلها مباشرة في منظومة المتابعة CRM وتعيين مستشار هندسي للتواصل معك.'}
            </p>
            <div className="pt-4 space-y-2 text-xs text-[#C5AEB5]">
              <div>البريد الرسمي: {siteData.websiteSettings.email}</div>
              <div>الهاتف: <span dir="ltr">{siteData.websiteSettings.phone}</span></div>
              <div>العنوان: {siteData.websiteSettings.address}</div>
            </div>
          </div>

          <form onSubmit={handleLeadSubmit} className="lg:col-span-7 bg-white text-[#211D25] rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold">نموذج طلب مشروع أو استشارة</h3>

            {leadFeedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  leadFeedback.ok
                    ? 'bg-[#ECFDF3] text-[#156E3F] border border-[#ABEFC6]'
                    : 'bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]'
                }`}
                role="status"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{leadFeedback.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lead-name" className="block text-xs font-medium mb-1">الاسم الكامل *</label>
                <input
                  id="lead-name"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label htmlFor="lead-org" className="block text-xs font-medium mb-1">اسم المؤسسة / الشركة</label>
                <input
                  id="lead-org"
                  value={leadForm.organization}
                  onChange={(e) => setLeadForm({ ...leadForm, organization: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label htmlFor="lead-email" className="block text-xs font-medium mb-1">البريد الإلكتروني *</label>
                <input
                  id="lead-email"
                  type="email"
                  required
                  dir="ltr"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label htmlFor="lead-phone" className="block text-xs font-medium mb-1">رقم الهاتف / واتساب *</label>
                <input
                  id="lead-phone"
                  required
                  dir="ltr"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
              <div>
                <label htmlFor="lead-service" className="block text-xs font-medium mb-1">الخدمة أو المنتج المطلوب</label>
                <select
                  id="lead-service"
                  value={leadForm.requestedService}
                  onChange={(e) => setLeadForm({ ...leadForm, requestedService: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm bg-white"
                >
                  {siteData.services.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {siteData.products.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lead-budget" className="block text-xs font-medium mb-1">الميزانية المتوقعة</label>
                <input
                  id="lead-budget"
                  value={leadForm.expectedBudget}
                  onChange={(e) => setLeadForm({ ...leadForm, expectedBudget: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="lead-details" className="block text-xs font-medium mb-1">تفاصيل المشروع المطلوب *</label>
              <textarea
                id="lead-details"
                required
                rows={3}
                value={leadForm.details}
                onChange={(e) => setLeadForm({ ...leadForm, details: e.target.value })}
                placeholder="اشرح باختصار أهداف النظام، عدد المستخدمين المتوقع، وأي متطلبات تكامل..."
                className="w-full px-3 py-2 rounded-lg border border-[#C5AEB5] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#705267] hover:bg-[#423441] text-white text-sm font-medium transition-colors"
            >
              {submitting ? 'جاري حفظ وإرسال الطلب...' : 'إرسال طلب المشروع'}
            </button>
          </form>
        </section>
      </main>

      <footer className="bg-white border-t border-[#D8C7CD] mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6A5866]">
          <span>{siteData.websiteSettings.footerLegalNote}</span>
          <span>{siteData.websiteSettings.orgName}</span>
        </div>
      </footer>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 bg-[#211D25]/65 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#6A5866]">{selectedProject.category} · {selectedProject.year}</div>
                <h3 className="text-xl font-bold text-[#211D25] mt-1">{selectedProject.name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedProject(null)} aria-label="إغلاق" className="p-1.5 rounded hover:bg-[#EEE2DF]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SafeImage src={selectedProject.coverImage} alt={selectedProject.name} className="w-full h-56 object-cover rounded-lg" />
            <div className="space-y-3 text-sm text-[#423441]">
              <div>
                <span className="font-bold text-[#211D25]">المشكلة: </span>
                {selectedProject.problemSolved}
              </div>
              <div>
                <span className="font-bold text-[#211D25]">الحل الهندسي: </span>
                {selectedProject.solutionProvided}
              </div>
              <div className="text-xs text-[#6A5866]">التقنيات المستخدمة: {selectedProject.technologies.join(' · ')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-[#211D25]/65 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#6A5866]">{selectedArticle.category} · {selectedArticle.authorName}</div>
                <h3 className="text-xl font-bold text-[#211D25] mt-1">{selectedArticle.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedArticle(null)} aria-label="إغلاق" className="p-1.5 rounded hover:bg-[#EEE2DF]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SafeImage src={selectedArticle.coverImage} alt={selectedArticle.title} className="w-full h-56 object-cover rounded-lg" />
            <p className="text-sm text-[#423441] leading-relaxed whitespace-pre-line">{selectedArticle.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}
