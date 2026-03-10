'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams, useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { LogOut, LayoutDashboard, BarChart2, Bell, Lightbulb, Settings, Menu, X, Search, Building2, Shield, Lock, CheckCircle2, TrendingUp } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/language-selector';
import { hasFeature, FEATURES, type FeatureKey } from '@/lib/feature-gate';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import { useTranslations } from 'next-intl';

function SignOutButton() {
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `${getSiteUrl()}/${locale}`;
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-transform"
      aria-label="Déconnexion"
      title="Déconnexion"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}

function StarNavIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

const navItems: Array<{
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  key: keyof typeof NAV_LABEL_KEYS;
  featureKey?: FeatureKey;
}> = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'overview' },
  { href: '/dashboard/reviews', icon: StarNavIcon, key: 'aiResponses' },
  { href: '/dashboard/statistics', icon: BarChart2, key: 'statistics' },
  { href: '/dashboard/alerts', icon: Bell, key: 'alerts', featureKey: FEATURES.WHATSAPP_ALERTS },
  { href: '/dashboard/growth', icon: TrendingUp, key: 'growth', featureKey: FEATURES.AI_CAPTURE },
  { href: '/dashboard/suggestions', icon: Lightbulb, key: 'suggestions' },
  { href: '/dashboard/settings', icon: Settings, key: 'settings' },
];

const NAV_LABEL_KEYS = {
  overview: 'overview',
  aiResponses: 'aiResponses',
  statistics: 'statistics',
  establishments: 'establishments',
  prospects: 'prospects',
  alerts: 'alerts',
  growth: 'growth',
  suggestions: 'suggestions',
  settings: 'settings',
  upgrade: 'upgrade',
} as const;

type Props = {
  establishmentName?: string;
  fullName?: string;
  avatarUrl?: string | null;
  hasDominatorPlan?: boolean;
  trialDaysLeft?: number | null;
  trialEndDate?: string | null;
  showTrialBanner?: boolean;
  planDisplayName?: string;
  selectedPlanSlug?: 'vision' | 'pulse' | 'zenith';
  isCriticalPhase?: boolean;
  showPaywall?: boolean;
  children: React.ReactNode;
};

const PLAN_TO_SLUG: Record<string, string> = {
  Vision: 'vision',
  Pulse: 'pulse',
  Zenith: 'zenith',
};

export function DashboardShell({
  establishmentName = 'Mon établissement',
  fullName = '',
  avatarUrl = null,
  hasDominatorPlan = false,
  trialDaysLeft = null,
  trialEndDate = null,
  showTrialBanner = false,
  planDisplayName = 'Pulse',
  selectedPlanSlug = 'pulse',
  isCriticalPhase = false,
  showPaywall = false,
  children,
}: Props) {
  const tSidebar = useTranslations('Dashboard.sidebar');
  const planSlug = PLAN_TO_SLUG[planDisplayName] ?? 'pulse';
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [upgradeModalFeature, setUpgradeModalFeature] = useState<FeatureKey | null>(null);
  const [shakingLock, setShakingLock] = useState<FeatureKey | null>(null);
  const qParam = searchParams?.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(qParam);
  const [showNotificationTrends, setShowNotificationTrends] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setSearchInput(qParam); }, [qParam]);

  useEffect(() => {
    if (!showNotificationTrends) return;
    const handler = (event: MouseEvent) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target as Node)) {
        setShowNotificationTrends(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotificationTrends]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (searchInput.trim()) params.set('q', searchInput.trim());
    else params.delete('q');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Overlay mobile - drawer backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden transition-opacity duration-300"
          aria-hidden
        />
      )}

      {/* Sidebar - Drawer mobile (<768px), fixed desktop */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-60 flex-col bg-[#0B1221] dark:bg-slate-950/95 dark:backdrop-blur-md border-r border-transparent dark:border-slate-800/80 dark:border-white/[0.07] text-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 lg:justify-start">
          <Link href="/" className="flex items-center gap-2.5" aria-label="REPUTEXA">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-white text-sm">R</span>
            </div>
            <span className="font-display font-bold text-lg tracking-tight">REPUTEXA</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-white/70 hover:bg-white/10"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Establishment card */}
        <div className="mx-3 mt-4 mb-2 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-3.5 h-3.5 text-blue-300" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{establishmentName}</p>
            <p className="text-xs text-white/40">{fullName || 'Restaurant'}</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname?.endsWith('/dashboard')
                : pathname?.startsWith(item.href);
            const Icon = item.icon;
            const label = tSidebar(NAV_LABEL_KEYS[item.key]);
            const locked = item.featureKey && !hasFeature(selectedPlanSlug, item.featureKey);
            const baseClass = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              locked ? 'opacity-50 cursor-pointer' : ''
            } ${
              isActive && !locked
                ? 'bg-blue-500 text-white shadow-glow'
                : locked
                  ? 'text-white/60 hover:opacity-70'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
            }`;
            if (locked) {
              const fk = item.featureKey!;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setShakingLock(fk);
                    setSidebarOpen(false);
                    setUpgradeModalFeature(fk);
                    setTimeout(() => setShakingLock(null), 400);
                  }}
                  className={`w-full text-left ${baseClass}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{label}</span>
                  <Lock
                    className={`w-3.5 h-3.5 ml-auto flex-shrink-0 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] ${shakingLock === fk ? 'animate-lock-shake' : ''}`}
                    aria-hidden
                  />
                </button>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={baseClass}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        {upgradeModalFeature && (
          <UpgradeModal
            featureKey={upgradeModalFeature}
            onClose={() => setUpgradeModalFeature(null)}
          />
        )}

        {/* Dominator badge / upgrade */}
        {hasDominatorPlan ? (
          <div className="m-3 p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/40 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-300 flex-shrink-0" />
            <span className="text-xs font-semibold text-emerald-100">
              Protection Dominator Active
            </span>
          </div>
        ) : (
          <div className="m-3 p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-400/20">
            <p className="text-xs font-semibold text-white mb-1">Plan Pro</p>
            <p className="text-xs text-white/60 mb-3">Débloquez les réponses illimitées</p>
            <Link
              href="/choose-plan"
              className="block w-full py-1.5 text-xs font-semibold gradient-primary rounded-lg text-white text-center hover:opacity-90 transition-opacity"
            >
              Upgrader
            </Link>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 lg:ml-60">
        {/* Header */}
        <header className="sticky top-0 z-20 h-14 min-h-[52px] sm:h-16 border-b border-slate-200 dark:border-slate-800/80 dark:border-white/[0.07] bg-white/95 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 safe-area-nav transition-colors duration-200">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-transform -ml-2"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-4 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher des avis..."
                className="w-full pl-9 pr-4 py-2.5 min-h-[40px] text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] rounded-2xl text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-indigo-500/50 focus:border-blue-500/40 transition-colors duration-200"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LanguageSelector variant="light" />
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setShowNotificationTrends((v) => !v)}
                className="relative flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-transform"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              </button>
              {showNotificationTrends && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900 shadow-lg dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] p-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-50">
                      Tendances détectées
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Aucune tendance négative marquante sur vos derniers avis.
                  </p>
                </div>
              )}
            </div>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 bg-slate-50 dark:bg-slate-950 dashboard-main-bg transition-colors duration-200 relative" data-dashboard="true">
          {showTrialBanner && !showPaywall && (
            <div
              className={`border-b px-4 sm:px-6 py-4 transition-colors duration-200 ${
                isCriticalPhase
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 animate-pulse-slow'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-200 dark:border-blue-900'
              }`}
            >
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className={`text-sm sm:text-base ${isCriticalPhase ? 'text-red-900 dark:text-red-100' : 'text-slate-800 dark:text-slate-200'}`}>
                  <span className="font-semibold">
                    Essai ZENITH : {trialDaysLeft ?? 0} jour{trialDaysLeft !== 1 ? 's' : ''} restant{trialDaysLeft !== 1 ? 's' : ''}
                  </span>
                  {trialEndDate && !isCriticalPhase && (
                    <> — se termine le <strong>{trialEndDate}</strong></>
                  )}
                  {isCriticalPhase && (
                    <> — expire bientôt !</>
                  )}
                </p>
                <Link
                  href={`/checkout?plan=${planSlug}`}
                  className={`shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-semibold text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                    isCriticalPhase
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {isCriticalPhase ? 'Activer mon abonnement maintenant' : `Passer en ${planDisplayName}`}
                </Link>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

