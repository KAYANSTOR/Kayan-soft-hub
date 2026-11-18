import React, { useCallback, useEffect, useState } from 'react';
import { hubApi, type BootstrapPayload, type SafeUser } from './lib/api';
import { hasPermission } from './shared/domain';
import type { UserRole } from './shared/types';
import { CmsHubView } from './components/CmsHubView';
import { CrmView } from './components/CrmView';
import { DashboardView } from './components/DashboardView';
import { AuditLogView, IntegrationsSyncView, OrgSettingsView, UsersRolesView } from './components/GovernanceViews';
import { LoginView } from './components/LoginView';
import { MediaLibraryView } from './components/MediaLibraryView';
import { PaymentsView, PlansView } from './components/PlansAndPaymentsView';
import { ProductsView } from './components/ProductsView';
import { PublicWebsiteView } from './components/PublicWebsiteView';
import { ReportsView } from './components/ReportsView';
import { NAV_ITEMS, Sidebar, type NavSectionId } from './components/Sidebar';
import { SubscribersView } from './components/SubscribersView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { TopBar } from './components/TopBar';

export default function App() {
  const [mode, setMode] = useState<'admin' | 'public_site'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#/site') return 'public_site';
    return 'admin';
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, tone: 'success' | 'error' = 'success') => {
    setToast({ msg, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadBootstrap = useCallback(async () => {
    const payload = await hubApi.getBootstrap();
    setData(payload);
    setUser(payload.currentUser);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const params = new URLSearchParams(window.location.search);
        const me = await hubApi.getMe();
        if (me.user) {
          await loadBootstrap();
        } else if (params.get('autostart') === '1') {
          await hubApi.quickRole('owner');
          await loadBootstrap();
        }
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    }
    init();
  }, [loadBootstrap]);

  // Ensure activeSection is always allowed for current user role
  useEffect(() => {
    if (!user) return;
    const currentItem = NAV_ITEMS.find((i) => i.id === activeSection);
    if (!currentItem || !hasPermission(user, currentItem.requiredPerm)) {
      const firstAllowed = NAV_ITEMS.find((i) => hasPermission(user, i.requiredPerm));
      if (firstAllowed) setActiveSection(firstAllowed.id);
    }
  }, [user, activeSection]);

  async function handleLoginSuccess(loggedUser: SafeUser) {
    setUser(loggedUser);
    await loadBootstrap();
    setMode('admin');
  }

  async function handleSwitchRole(role: UserRole) {
    await hubApi.quickRole(role);
    await loadBootstrap();
    showToast('تم تبديل الجلسة وتطبيق صلاحيات الدور المحدد من الخادم.');
  }

  async function handleLogout() {
    await hubApi.logout();
    setUser(null);
    setData(null);
  }

  if (mode === 'public_site') {
    return (
      <PublicWebsiteView
        hasAdminSession={Boolean(user)}
        onBackToAdmin={() => {
          window.location.hash = '';
          setMode('admin');
          if (user) {
            loadBootstrap();
          }
        }}
      />
    );
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#EEE2DF] flex items-center justify-center text-sm text-[#211D25]">
        جاري تهيئة Kayan Soft Hub...
      </div>
    );
  }

  if (!user || !data) {
    return (
      <LoginView
        onSuccess={handleLoginSuccess}
        onOpenPublicSite={() => {
          window.location.hash = '#/site';
          setMode('public_site');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F1EF] flex">
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSelect={(sec) => {
          setActiveSection(sec);
          setSearchQuery('');
        }}
        onOpenPublicSite={() => {
          window.location.hash = '#/site';
          setMode('public_site');
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          user={user}
          activeSection={activeSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={handleLogout}
        />

        {toast && (
          <div className="px-4 lg:px-8 pt-4">
            <div
              role="status"
              className={`p-3.5 rounded-xl border text-sm flex items-center justify-between ${
                toast.tone === 'error'
                  ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                  : 'bg-white border-[#705267] text-[#211D25]'
              }`}
            >
              <span>{toast.msg}</span>
              <button type="button" onClick={() => setToast(null)} className="text-xs underline">
                إغلاق
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'dashboard' && <DashboardView data={data} onNavigate={setActiveSection} />}
          {activeSection === 'products' && (
            <ProductsView data={data} searchQuery={searchQuery} onRefresh={loadBootstrap} onNotify={showToast} />
          )}
          {activeSection === 'subscribers' && (
            <SubscribersView data={data} searchQuery={searchQuery} onRefresh={loadBootstrap} onNotify={showToast} />
          )}
          {activeSection === 'subscriptions' && (
            <SubscriptionsView data={data} searchQuery={searchQuery} onRefresh={loadBootstrap} onNotify={showToast} />
          )}
          {activeSection === 'plans' && <PlansView data={data} />}
          {activeSection === 'payments' && <PaymentsView data={data} searchQuery={searchQuery} />}
          {activeSection === 'reports' && <ReportsView data={data} />}
          {activeSection === 'cms' && (
            <CmsHubView
              data={data}
              onRefresh={loadBootstrap}
              onNotify={showToast}
              onOpenPublicSite={() => {
                window.location.hash = '#/site';
                setMode('public_site');
              }}
            />
          )}
          {activeSection === 'crm' && (
            <CrmView data={data} searchQuery={searchQuery} onRefresh={loadBootstrap} onNotify={showToast} />
          )}
          {activeSection === 'media' && (
            <MediaLibraryView data={data} searchQuery={searchQuery} onRefresh={loadBootstrap} onNotify={showToast} />
          )}
          {activeSection === 'users' && (
            <UsersRolesView
              data={data}
              onRefresh={loadBootstrap}
              onNotify={showToast}
              onSwitchRole={handleSwitchRole}
            />
          )}
          {activeSection === 'audit' && <AuditLogView data={data} searchQuery={searchQuery} />}
          {activeSection === 'integrations' && (
            <IntegrationsSyncView data={data} onRefresh={loadBootstrap} onNotify={showToast} />
          )}
          {activeSection === 'settings' && (
            <OrgSettingsView data={data} onRefresh={loadBootstrap} onNotify={showToast} />
          )}
        </main>
      </div>
    </div>
  );
}
