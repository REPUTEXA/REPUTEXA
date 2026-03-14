'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams, useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { LogOut, LayoutDashboard, BarChart2, Bell, Lightbulb, Settings, Menu, X, Search, Building2, CheckCircle2, TrendingUp, FileText, Sparkles, ArrowUpCircle } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/language-selector';
import { checkPlan, type PlanSlug } from '@/lib/feature-gate';
import { PlanBadge } from './plan-badge';
import { EstablishmentSelector } from './establishment-selector';
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
      className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-2xl text-slate-600 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98] transition-transform"
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
  minPlan: PlanSlug;
}> = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'overview', minPlan: 'vision' },
  { href: '/dashboard/reviews', icon: StarNavIcon, key: 'aiResponses', minPlan: 'vision' },
  { href: '/dashboard/statistics', icon: BarChart2, key: 'statistics', minPlan: 'vision' },
  { href: '/dashboard/consultant', icon: Sparkles, key: 'consultant', minPlan: 'zenith' },
  { href: '/dashboard/alerts', icon: Bell, key: 'alerts', minPlan: 'pulse' },
  { href: '/dashboard/growth', icon: TrendingUp, key: 'growth', minPlan: 'zenith' },
  { href: '/dashboard/suggestions', icon: Lightbulb, key: 'suggestions', minPlan: 'pulse' },
  { href: '/dashboard/establishments', icon: Building2, key: 'establishments', minPlan: 'vision' },
  { href: '/dashboard/upgrade', icon: ArrowUpCircle, key: 'upgrade', minPlan: 'vision' },
  { href: '/dashboard/settings', icon: Settings, key: 'settings', minPlan: 'vision' },
];

const NAV_LABEL_KEYS = {
  overview: 'overview',
  aiResponses: 'aiResponses',
  statistics: 'statistics',
  consultant: 'consultant',
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
  trialDaysLeft?: number | null;
  trialEndDate?: string | null;
  showTrialBanner?: boolean;
  planDisplayName?: string;
  selectedPlanSlug?: PlanSlug;
  isCriticalPhase?: boolean;
  showPaywall?: boolean;
  isTrialing?: boolean;
  hasActiveSubscription?: boolean;
  locale?: string;
  children: React.ReactNode;
};

const PLAN_TO_SLUG: Record<string, string> = {
  Vision: 'vision',
  Pulse: 'pulse',
  Zenith: 'zenith',
  ZENITH: 'zenith',
};

export function DashboardShell({
  establishmentName = 'Mon établissement',
  fullName = '',
  avatarUrl = null,
  trialDaysLeft = null,
  trialEndDate = null,
  showTrialBanner = false,
  planDisplayName = 'Pulse',
  selectedPlanSlug = 'pulse',
  isCriticalPhase = false,
  showPaywall = false,
  isTrialing = false,
  hasActiveSubscription = false,
  locale = 'fr',
  children,
}: Props) {
  const tSidebar = useTranslations('Dashboard.sidebar');
  const planSlug = PLAN_TO_SLUG[planDisplayName] ?? 'pulse';
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const qParam = searchParams?.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(qParam);
  const [showNotificationTrends, setShowNotificationTrends] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const [toxicAlertsCount, setToxicAlertsCount] = useState<number | null>(null);
  const [weeklyInsight, setWeeklyInsight] = useState<{
    top_section: string | null;
    watch_section: string | null;
    trend_severity: number | null;
    week_start?: string;
  } | null>(null);
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

  const refreshToxicCount = useCallback(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setToxicAlertsCount(0);
        return;
      }
      const { count } = await supabase
        .from('reviews')
        .select('id', { head: true, count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_toxic', true)
        .is('toxicity_resolved_at', null);
      setToxicAlertsCount(count ?? 0);
    }).catch(() => setToxicAlertsCount(0));
  }, []);

  useEffect(() => {
    refreshToxicCount();
  }, [refreshToxicCount]);

  useEffect(() => {
    window.addEventListener('toxic-alert-resolved', refreshToxicCount);
    return () => window.removeEventListener('toxic-alert-resolved', refreshToxicCount);
  }, [refreshToxicCount]);

  const isPulseOrZenith = selectedPlanSlug === 'pulse' || selectedPlanSlug === 'zenith';
  useEffect(() => {
    if (!isPulseOrZenith) return;
    fetch('/api/weekly-insight')
      .then((r) => r.json())
      .then((data) => {
        const ins = data.insight;
        if (ins) {
          setWeeklyInsight({
            top_section: ins.top_section ?? null,
            watch_section: ins.watch_section ?? null,
            trend_severity: ins.trend_severity ?? null,
            week_start: ins.week_start,
          });
        }
      })
      .catch(() => {});
  }, [isPulseOrZenith]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (searchInput.trim()) params.set('q', searchInput.trim());
    else params.delete('q');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#030303] transition-colors duration-200 overflow-x-hidden">
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
        className={`fixed left-0 top-0 z-40 flex h-full w-60 flex-col bg-[#0B1221] dark:bg-black/40 dark:backdrop-blur-xl border-r border-transparent dark:border-zinc-800/50 text-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 dark:border-zinc-800/50 px-4 lg:justify-start">
          <Link href="/" className="flex items-center gap-2.5" aria-label="REPUTEXA">
            <Logo size="sm" />
            <span className="font-display font-bold text-lg tracking-[0.18em]">
              REPUTEXA
            </span>
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

        {/* Establishment selector dropdown */}
        <EstablishmentSelector
          avatarUrl={avatarUrl}
          establishmentName={establishmentName}
          fullName={fullName}
          selectedPlanSlug={selectedPlanSlug}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems
            .filter((item) => checkPlan(selectedPlanSlug, item.minPlan))
            .map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard' || pathname?.endsWith('/dashboard')
                  : pathname?.startsWith(item.href);
              const Icon = item.icon;
              const label = tSidebar(NAV_LABEL_KEYS[item.key]);
              const baseClass = `flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-300 ease-in-out ${
                isActive
                  ? 'bg-primary text-white shadow-[#2563eb]/20 shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5 dark:hover:bg-white/5'
              }`;
              const showAlertsBadge = item.key === 'alerts' && toxicAlertsCount !== null && toxicAlertsCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={baseClass}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="relative inline-flex items-center gap-1">
                    {label}
                    {showAlertsBadge && (
                      <span className="inline-flex h-4 min-w-[14px] rounded-full bg-red-500 text-[10px] font-semibold text-white items-center justify-center px-1">
                        {toxicAlertsCount > 9 ? '9+' : toxicAlertsCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
        </nav>
        <PlanBadge
          planSlug={selectedPlanSlug}
          planDisplayName={planDisplayName}
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          hasActiveSubscription={hasActiveSubscription}
          locale={locale}
        />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 lg:ml-60">
        {/* Header */}
        <header className="sticky top-0 z-20 h-14 min-h-[52px] sm:h-16 border-b border-slate-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 safe-area-nav transition-colors duration-300">
                <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-2xl text-slate-600 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-in-out -ml-2"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-4 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher des avis..."
              className="w-full pl-9 pr-4 py-2.5 min-h-[40px] text-sm bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-2xl text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 dark:focus:ring-indigo-500/30 focus:border-primary dark:focus:border-zinc-700 transition-colors duration-200"
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
                className="relative flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-2xl text-slate-500 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-in-out"
                aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {toxicAlertsCount !== null && toxicAlertsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
                      {toxicAlertsCount > 9 ? '9+' : toxicAlertsCount}
                    </span>
                  )}
              </button>
              {showNotificationTrends && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] shadow-lg dark:shadow-xl p-3 text-sm space-y-2">
                  {toxicAlertsCount !== null && toxicAlertsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotificationTrends(false);
                        router.push('/dashboard/alerts');
                      }}
                      className="w-full flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 px-3 py-2 text-left hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                    >
                      <span className="mt-0.5 text-red-500 text-base">🚨</span>
                      <div>
                        <p className="text-xs font-semibold text-red-700 dark:text-red-200">
                          Action requise : avis toxique détecté
                        </p>
                        <p className="text-[11px] text-red-700/80 dark:text-red-200/80">
                          {toxicAlertsCount === 1
                            ? '1 avis est en attente dans le Bouclier IA.'
                            : `${toxicAlertsCount} avis sont en attente dans le Bouclier IA.`}
                        </p>
                      </div>
                    </button>
                  )}
                  <div className="mt-1 space-y-2">
                    {weeklyInsight && (weeklyInsight.trend_severity ?? 0) > 0 && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 px-3 py-2">
                        <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 mb-1">
                          Alerte de tendance
                        </p>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-2">
                          <div
                            className={`h-1.5 rounded-full ${
                              (weeklyInsight.trend_severity ?? 0) >= 70 ? 'bg-red-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, weeklyInsight.trend_severity ?? 0)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90 line-clamp-2">
                          {weeklyInsight.watch_section || 'Signal à surveiller.'}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                          Tendances détectées
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                          {weeklyInsight?.top_section
                            ? `${weeklyInsight.top_section.slice(0, 60)}${weeklyInsight.top_section.length > 60 ? '…' : ''}`
                            : 'Aucune tendance négative marquante sur vos derniers avis.'}
                        </p>
                      </div>
                    </div>
                    {isPulseOrZenith && (
                      <Link
                        href="/dashboard/statistics?tab=weekly#weekly"
                        onClick={() => setShowNotificationTrends(false)}
                        className="flex items-center gap-2 w-full rounded-lg bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                        Voir l&apos;analyse détaillée
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 min-h-0 bg-slate-50 dark:bg-[#030303] dashboard-main-bg transition-colors duration-200 relative overflow-y-visible" data-dashboard="true">
          {showTrialBanner && !showPaywall && (
            <div
              className={`border-b px-4 sm:px-6 py-3 transition-colors duration-200 ${
                isCriticalPhase
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 animate-pulse-slow'
                  : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className={`text-sm ${isCriticalPhase ? 'text-red-900 dark:text-red-100 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                  <span>
                    {planDisplayName === 'ZENITH' || planDisplayName === 'zenith'
                      ? `Il vous reste ${trialDaysLeft ?? 0} jour${trialDaysLeft !== 1 ? 's' : ''} d'essai Zénith. Profitez de toutes les fonctions !`
                      : `Il vous reste ${trialDaysLeft ?? 0} jour${trialDaysLeft !== 1 ? 's' : ''} d'essai. — se termine le ${trialEndDate ?? ''}`}
                  </span>
                  {isCriticalPhase && (
                    <> — expire bientôt !</>
                  )}
                </p>
                <Link
                  href={`/checkout?plan=${planSlug}${isCriticalPhase ? '&trial=0' : ''}`}
                  className={`shrink-0 inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-2xl font-semibold text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] transition-all duration-300 ease-in-out ${
                    isCriticalPhase
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-primary hover:brightness-110 focus:ring-[#2563eb]'
                  } ${planDisplayName.toLowerCase() === 'zenith' ? 'shiny-button' : ''}`}
                >
                  {isCriticalPhase
                    ? 'Activer mon abonnement maintenant'
                    : `Passer en ${planDisplayName}`}
                </Link>
              </div>
            </div>
          )}
          <div className="relative z-10 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

