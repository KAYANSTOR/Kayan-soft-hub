import React, { useState } from 'react';
import { Globe, Lock, ShieldCheck } from 'lucide-react';
import { hubApi, type SafeUser } from '../lib/api';
import { ROLE_LABELS_AR } from '../shared/domain';
import type { UserRole } from '../shared/types';

const QUICK_TEST_ROLES: Array<{ role: UserRole; hint: string }> = [
  { role: 'owner', hint: 'كامل الصلاحيات والإعدادات' },
  { role: 'site_manager', hint: 'إدارة الموقع وCMS والوسائط' },
  { role: 'content_editor', hint: 'تحرير المحتوى دون نشر أو اشتراكات' },
  { role: 'subscription_manager', hint: 'إدارة الاشتراكات والمشتركين' },
  { role: 'sales_rep', hint: 'العملاء وطلبات CRM فقط' },
  { role: 'accountant', hint: 'المدفوعات والتقارير المالية' },
];

export function LoginView({
  onSuccess,
  onOpenPublicSite,
}: {
  onSuccess: (user: SafeUser) => void;
  onOpenPublicSite: () => void;
}) {
  const [email, setEmail] = useState('owner@kayansoft.sa');
  const [password, setPassword] = useState('Kayan@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await hubApi.login(email, password);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickRole(role: UserRole) {
    setError(null);
    setLoading(true);
    try {
      const res = await hubApi.quickRole(role);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEE2DF] flex flex-col justify-between p-6 lg:p-10">
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#211D25] text-[#EEE2DF] flex items-center justify-center font-display font-bold text-lg">
            ك
          </div>
          <div>
            <p className="font-display font-bold text-lg text-[#211D25] leading-tight">Kayan Soft Hub</p>
            <p className="text-xs text-[#6A5866]">منصة الإدارة المركزية لمؤسسة كيان سوفت</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenPublicSite}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[#C5AEB5] bg-white text-[#211D25] hover:bg-[#211D25] hover:text-white transition-colors whitespace-nowrap"
        >
          <Globe className="w-4 h-4" />
          <span>استعراض موقع كيان سوفت الرسمي</span>
        </button>
      </div>

      <main className="max-w-5xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <section className="lg:col-span-6 bg-[#211D25] text-[#EEE2DF] rounded-xl p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs text-[#C5AEB5] mb-3">إدارة مركزية · أنظمة تشغيل مستقلة</p>
            <h1 className="text-3xl font-bold leading-snug mb-4">
              مركز التحكم المؤسسي لمنتجات كيان سوفت وموقعها الرسمي
            </h1>
            <p className="text-sm text-[#C5AEB5] leading-relaxed">
              إدارة موحدة للمنتجات والمشتركين والاشتراكات، ونظام إدارة محتوى مرئي متكامل CMS، ونظام CRM دائم لاستقبال ومتابعة طلبات العملاء وفق صلاحيات دقيقة مفروضة على الخادم.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-[#423441] space-y-3 text-xs text-[#C5AEB5]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#987988] shrink-0" />
              <span>جلسات موقعة ومحمية مع سجل تدقيق غير قابل للتعديل</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#987988] shrink-0" />
              <span>عزل تام لقواعد بيانات المنتجات والتزام بعقود API المعتمدة</span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-[#C5AEB5] rounded-xl p-8">
          <h2 className="text-xl font-bold text-[#211D25] mb-1">تسجيل الدخول إلى لوحة الإدارة</h2>
          <p className="text-sm text-[#6A5866] mb-6">أدخل بيانات اعتماد الموظف أو اختر دوراً لاختبار الصلاحيات</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[#211D25] mb-1.5">
                البريد الإلكتروني المؤسسي
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#C5AEB5] bg-white text-[#211D25] text-sm"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[#211D25] mb-1.5">
                كلمة المرور
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#C5AEB5] bg-white text-[#211D25] text-sm"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#705267] hover:bg-[#423441] text-white font-medium text-sm transition-colors"
            >
              {loading ? 'جاري التحقق من الجلسة...' : 'دخول إلى المنصة'}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-[#EEE2DF]">
            <p className="text-xs font-medium text-[#423441] mb-3">
              دخول سريع لاختبار الأدوار والصلاحيات (RBAC):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_TEST_ROLES.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickRole(item.role)}
                  className="text-right p-2.5 rounded-lg border border-[#D8C7CD] hover:border-[#705267] hover:bg-[#EEE2DF]/60 transition-colors"
                >
                  <div className="text-xs font-bold text-[#211D25]">{ROLE_LABELS_AR[item.role]}</div>
                  <div className="text-[11px] text-[#6A5866] mt-0.5 truncate">{item.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-[#6A5866]">
        مؤسسة كيان سوفت للبرمجيات والحلول الذكية · Kayan Soft Hub
      </footer>
    </div>
  );
}
