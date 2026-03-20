'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams, useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { LogOut, LayoutDashboard, BarChart2, Bell, Lightbulb, Settings, Menu, X, Search, Building2, CheckCircle2, FileText, Rss, Loader2, MessageCircle, ShieldCheck, Headphones } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/language-selector';
import { checkPlan, type PlanSlug } from '@/lib/feature-gate';
import { useActiveLocationOptional } from '@/lib/active-location-context';
import { useSubscription } from '@/lib/use-subscription';
import { WelcomeFlash } from './welcome-flash';
import { PlanBadge } from './plan-badge';
import { EstablishmentSelector } from './establishment-selector';
import { UpdatesModal } from './updates-modal';
import { LegalConsentModal } from './legal-consent-modal';
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
  { href: '/dashboard/alerts', icon: Bell, key: 'alerts', minPlan: 'pulse' },
  { href: '/dashboard/collecte-avis', icon: MessageCircle, key: 'collecteAvis', minPlan: 'zenith' },
  { href: '/dashboard/suggestions', icon: Lightbulb, key: 'suggestions', minPlan: 'pulse' },
  { href: '/dashboard/updates', icon: Rss, key: 'updates', minPlan: 'vision' },
  { href: '/dashboard/establishments', icon: Building2, key: 'establishments', minPlan: 'vision' },
  { href: '/dashboard/support', icon: Headphones, key: 'support', minPlan: 'free' },
  { href: '/dashboard/settings', icon: Settings, key: 'settings', minPlan: 'vision' },
];

const NAV_LABEL_KEYS = {
  overview: 'overview',
  aiResponses: 'aiResponses',
  statistics: 'statistics',
  establishments: 'establishments',
  prospects: 'prospects',
  alerts: 'alerts',
  collecteAvis: 'collecteAvis',
  suggestions: 'suggestions',
  updates: 'updates',
  support: 'support',
  settings: 'settings',
} as const;

type Props = {
  firstLogin?: boolean;
  establishmentName?: string;
  fullName?: string;
  avatarUrl?: string | null;
  trialDaysLeft?: number | null;
  trialEndDate?: string | null;
  showTrialBanner?: boolean;
  planDisplayName?: string;
  selectedPlanSlug?: PlanSlug;
  selectedPlanFromProfile?: string | null;
  isCriticalPhase?: boolean;
  showPaywall?: boolean;
  isTrialing?: boolean;
  hasActiveSubscription?: boolean;
  locale?: string;
  subscriptionQuantity?: number;
  updatesNewCount?: number;
  showPastDueBanner?: boolean;
  needsLegalConsent?: boolean;
  currentLegalVersion?: number;
  legalSummary?: string;
  legalEffectiveDate?: string;
  isAdmin?: boolean;
  children: React.ReactNode;
};

const PLAN_TO_SLUG: Record<string, string> = {
  Vision: 'vision',
  Pulse: 'pulse',
  Zenith: 'zenith',
  ZENITH: 'zenith',
};

export function DashboardShell({
  firstLogin = true,
  establishmentName = 'Mon établissement',
  fullName = '',
  avatarUrl = null,
  trialDaysLeft = null,
  trialEndDate: _trialEndDate = null,
  showTrialBanner = false,
  planDisplayName = 'Pulse',
  selectedPlanSlug = 'pulse',
  selectedPlanFromProfile = null,
  isCriticalPhase = false,
  showPaywall = false,
  isTrialing = false,
  hasActiveSubscription = false,
  locale = 'fr',
  subscriptionQuantity: _subscriptionQuantity = 1,
  updatesNewCount = 0,
  showPastDueBanner = false,
  needsLegalConsent = false,
  currentLegalVersion = 0,
  legalSummary = '',
  legalEffectiveDate = '',
  isAdmin = false,
  children,
}: Props) {
  const tSidebar = useTranslations('Dashboard.sidebar');
  const _planSlug = PLAN_TO_SLUG[planDisplayName] ?? 'pulse';
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeLocation = useActiveLocationOptional();
  const subscription = useSubscription();
  const subscriptionQuantityFromStripe = subscription.isError ? 1 : subscription.quantity;
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
  const [updatesModalOpen, setUpdatesModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(needsLegalConsent);
  useEffect(() => { setSearchInput(qParam); }, [qParam]);

  // Modale "Quoi de neuf" : déclenchée par UpgradeSuccessToast via événement (URL déjà nettoyée par le toast)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      timeoutId = setTimeout(() => setUpdatesModalOpen(true), 400);
    };
    window.addEventListener('dashboard-show-updates-modal', handler);
    return () => {
      window.removeEventListener('dashboard-show-updates-modal', handler);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

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
            <span className="font-display font-bold text-lg tracking-[0.18em] uppercase">
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
          subscriptionQuantity={subscriptionQuantityFromStripe}
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
              const showUpdatesNewBadge = item.key === 'updates' && updatesNewCount > 0;
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
                    {showUpdatesNewBadge && (
                      <span className="inline-flex px-1.5 py-0 rounded-md bg-emerald-500 text-[10px] font-bold text-white uppercase tracking-wide">
                        New
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
        </nav>
        {isAdmin && (
          <div className="px-2 py-2 border-t border-white/10 dark:border-zinc-800/50">
            <Link
              href="/dashboard/admin"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-300 ease-in-out ${
                pathname?.startsWith('/dashboard/admin')
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-zinc-500 hover:text-blue-400 hover:bg-blue-600/10 border border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Admin Panel</span>
            </Link>
          </div>
        )}
        <PlanBadge
          planSlug={selectedPlanSlug}
          planDisplayName={planDisplayName}
          selectedPlanFromProfile={selectedPlanFromProfile}
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          hasActiveSubscription={hasActiveSubscription}
          locale={locale}
        />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 lg:ml-60 relative">
        {/* Bannière élégante si Stripe indisponible (Apple-style) */}
        {subscription.isError && (
          <div className="absolute top-0 left-0 right-0 z-30 rounded-b-2xl border-b border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 flex items-center justify-center gap-3 text-sm">
            <span className="text-amber-800 dark:text-amber-200">Impossible de charger l&apos;abonnement.</span>
            <button
              type="button"
              onClick={() => subscription.refetch()}
              className="font-semibold text-amber-700 dark:text-amber-300 hover:underline"
            >
              Réessayer
            </button>
          </div>
        )}
        {/* Loading overlay (Apple-style) when switching establishment */}
        {activeLocation?.isSwitching && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-[#030303]/80 backdrop-blur-md transition-opacity duration-300"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Chargement…</span>
            </div>
          </div>
        )}
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
          <WelcomeFlash firstLogin={firstLogin} planDisplayName={planDisplayName} />
          {showPastDueBanner && (
            <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60">
              <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4">
                <p className="text-sm sm:text-base text-red-900 dark:text-red-100 font-medium">
                  Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour éviter toute interruption de service.
                </p>
                <Link
                  href="/dashboard/settings"
                  className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-white text-sm bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 active:scale-[0.98] transition-all duration-200"
                >
                  Mettre à jour ma carte
                </Link>
              </div>
            </div>
          )}
          {showTrialBanner && !showPaywall && (
            <div
              className={`border-b transition-colors duration-200 ${
                isCriticalPhase
                  ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                  : 'bg-white dark:bg-zinc-900/95 border-slate-200/80 dark:border-zinc-800/80'
              }`}
            >
              <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-3.5">
                <p className={`text-sm sm:text-base ${isCriticalPhase ? 'text-amber-900 dark:text-amber-100 font-medium' : 'text-slate-800 dark:text-zinc-200'}`}>
                  🚀 Essai Zénith : plus que {trialDaysLeft ?? 0} jour{(trialDaysLeft ?? 0) !== 1 ? 's' : ''}.
                  {isCriticalPhase && (
                    <span className="ml-1 font-semibold">— expire bientôt !</span>
                  )}
                </p>
                <Link
                  href="/dashboard/settings#billing"
                  className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-2xl font-semibold text-sm bg-[#2563eb] text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 dark:focus:ring-offset-zinc-900 active:scale-[0.98] transition-all duration-200"
                >
                  Choisir mon futur plan
                </Link>
              </div>
            </div>
          )}
          <div className="relative z-10 min-h-full">
            {children}
          </div>
        </main>
      </div>
      <UpdatesModal
        open={updatesModalOpen}
        onClose={() => setUpdatesModalOpen(false)}
        locale={locale}
      />
      <LegalConsentModal
        open={legalModalOpen}
        currentVersion={currentLegalVersion}
        summaryOfChanges={legalSummary}
        effectiveDateFormatted={legalEffectiveDate}
        onAccepted={() => setLegalModalOpen(false)}
      />
    </div>
  );
}

