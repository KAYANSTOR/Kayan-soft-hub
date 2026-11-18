import React from 'react';
import { LogOut, Menu, Search } from 'lucide-react';
import { ROLE_LABELS_AR } from '../shared/domain';
import type { SafeUser } from '../lib/api';
import { NAV_ITEMS, type NavSectionId } from './Sidebar';

export function TopBar({
  user,
  activeSection,
  searchQuery,
  onSearchChange,
  onOpenMobileMenu,
  onLogout,
}: {
  user: SafeUser;
  activeSection: NavSectionId;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}) {
  const current = NAV_ITEMS.find((i) => i.id === activeSection);

  return (
    <header className="bg-white border-b border-[#D8C7CD] px-4 lg:px-8 h-16 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="فتح القائمة الجانبية"
          className="lg:hidden p-2 rounded-lg border border-[#D8C7CD] text-[#211D25] hover:bg-[#EEE2DF]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-[#6A5866] hidden sm:inline whitespace-nowrap">كيان سوفت</span>
          <span className="text-[#C5AEB5] hidden sm:inline" aria-hidden="true">/</span>
          <span className="font-bold text-[#211D25] truncate">{current?.label || 'لوحة القيادة'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block w-64">
          <Search className="w-4 h-4 text-[#6A5866] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث سريع في السجلات..."
            aria-label="بحث عام"
            className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-[#D8C7CD] bg-[#F6F1EF] text-sm text-[#211D25] placeholder:text-[#6A5866]"
          />
        </div>

        <span className="hidden sm:inline text-xs text-[#423441] whitespace-nowrap">
          {user.name} · {ROLE_LABELS_AR[user.role]}
        </span>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C5AEB5] text-xs font-medium text-[#211D25] hover:bg-[#EEE2DF] whitespace-nowrap shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>خروج</span>
        </button>
      </div>
    </header>
  );
}
