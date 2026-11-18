import React from 'react';
import {
  Activity,
  BarChart3,
  Blocks,
  Briefcase,
  CreditCard,
  FileText,
  FolderKanban,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { hasPermission, ROLE_LABELS_AR } from '../shared/domain';
import type { Permission } from '../shared/types';
import type { SafeUser } from '../lib/api';

export type NavSectionId =
  | 'dashboard'
  | 'products'
  | 'subscribers'
  | 'subscriptions'
  | 'plans'
  | 'payments'
  | 'reports'
  | 'cms'
  | 'crm'
  | 'media'
  | 'users'
  | 'audit'
  | 'integrations'
  | 'settings';

export interface NavItem {
  id: NavSectionId;
  label: string;
  group: 'المؤسسة والمنتجات' | 'الموقع والعملاء' | 'الحوكمة والأمان';
  icon: React.ComponentType<{ className?: string }>;
  requiredPerm: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'لوحة القيادة', group: 'المؤسسة والمنتجات', icon: LayoutDashboard, requiredPerm: 'dashboard.view' },
  { id: 'products', label: 'منتجات المؤسسة', group: 'المؤسسة والمنتجات', icon: Blocks, requiredPerm: 'products.view' },
  { id: 'subscribers', label: 'المشتركين', group: 'المؤسسة والمنتجات', icon: Users, requiredPerm: 'subscribers.view' },
  { id: 'subscriptions', label: 'الاشتراكات', group: 'المؤسسة والمنتجات', icon: RefreshCw, requiredPerm: 'subscriptions.view' },
  { id: 'plans', label: 'الباقات والخطط', group: 'المؤسسة والمنتجات', icon: Layers, requiredPerm: 'plans.view' },
  { id: 'payments', label: 'المدفوعات', group: 'المؤسسة والمنتجات', icon: CreditCard, requiredPerm: 'payments.view' },
  { id: 'reports', label: 'التقارير', group: 'المؤسسة والمنتجات', icon: BarChart3, requiredPerm: 'reports.view' },
  { id: 'cms', label: 'إدارة الموقع', group: 'الموقع والعملاء', icon: Globe, requiredPerm: 'cms.view' },
  { id: 'crm', label: 'العملاء وCRM', group: 'الموقع والعملاء', icon: Briefcase, requiredPerm: 'crm.view' },
  { id: 'media', label: 'الوسائط', group: 'الموقع والعملاء', icon: ImageIcon, requiredPerm: 'media.view' },
  { id: 'users', label: 'المستخدمون والصلاحيات', group: 'الحوكمة والأمان', icon: ShieldCheck, requiredPerm: 'users.view' },
  { id: 'audit', label: 'سجل التدقيق', group: 'الحوكمة والأمان', icon: FileText, requiredPerm: 'audit.view' },
  { id: 'integrations', label: 'التكاملات والمزامنة', group: 'الحوكمة والأمان', icon: Activity, requiredPerm: 'integrations.view' },
  { id: 'settings', label: 'إعدادات المؤسسة', group: 'الحوكمة والأمان', icon: Settings, requiredPerm: 'settings.view' },
];

export function Sidebar({
  user,
  activeSection,
  onSelect,
  onOpenPublicSite,
  mobileOpen,
  onCloseMobile,
}: {
  user: SafeUser;
  activeSection: NavSectionId;
  onSelect: (id: NavSectionId) => void;
  onOpenPublicSite: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const groups: Array<NavItem['group']> = ['المؤسسة والمنتجات', 'الموقع والعملاء', 'الحوكمة والأمان'];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#211D25] text-[#EEE2DF] w-[264px] shrink-0">
      <div className="px-5 py-5 border-b border-[#423441] flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#705267] text-white flex items-center justify-center font-display font-bold text-base shrink-0">
            ك
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-base text-white truncate">Kayan Soft Hub</p>
            <p className="text-[11px] text-[#C5AEB5] truncate">الإدارة المركزية للمؤسسة</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="إغلاق القائمة"
          className="lg:hidden p-1.5 rounded-lg text-[#C5AEB5] hover:bg-[#423441]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="القائمة الرئيسية">
        {groups.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group && hasPermission(user, item.requiredPerm));
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-3 mb-2 text-[11px] font-medium text-[#987988]">{group}</p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(item.id);
                          onCloseMobile();
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#705267] text-white font-medium'
                            : 'text-[#EEE2DF]/85 hover:bg-[#423441] hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#423441] space-y-3">
        <button
          type="button"
          onClick={onOpenPublicSite}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#423441] hover:bg-[#705267] text-white text-xs font-medium transition-colors whitespace-nowrap"
        >
          <FolderKanban className="w-3.5 h-3.5 shrink-0" />
          <span>معاينة الموقع الرسمي</span>
        </button>
        <div className="text-xs text-[#C5AEB5] px-1">
          <div className="font-medium text-white truncate">{user.name}</div>
          <div className="text-[11px] text-[#987988] mt-0.5">{ROLE_LABELS_AR[user.role]}</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-[#211D25]/60" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
