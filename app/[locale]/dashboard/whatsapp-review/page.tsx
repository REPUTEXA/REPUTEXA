'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  Radar,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { readActivityProfileDraftCategory } from '@/lib/collecte/activity-profile-draft';
import { BananoClientsErrorBoundary } from '@/components/banano/banano-clients-error-boundary';
import { DashboardInlineLoading } from '@/components/dashboard/dashboard-inline-loading';

/** Prop technique : variante embarquée de la page Collecte (API). */
const COLLECTE_PAGE_VARIANT_WHATSAPP_REVIEW = 'whatsapp-review' as const;

function WhatsappReviewTabLoading() {
  return <DashboardInlineLoading />;
}

const CollecteAvisPage = dynamic(
  () =>
    import('../collecte-avis/collecte-avis-page-client').then((m) => ({
      default: m.CollecteAvisPage,
    })),
  {
    loading: () => <WhatsappReviewTabLoading />,
  }
);

const BananoOmnipresentDashboard = dynamic(
  () =>
    import('@/components/banano/banano-omnipresent-dashboard').then((m) => ({
      default: m.BananoOmnipresentDashboard,
    })),
  { loading: () => <WhatsappReviewTabLoading /> }
);

/** Pas de SSR : gros arbre client (lucide, presets, aperçu) — évite erreurs webpack « moduleId is not a function » sur le bundle serveur en dev. */
const WalletDesignerPanel = dynamic(
  () => import('@/components/banano/wallet-designer-panel'),
  { loading: () => <WhatsappReviewTabLoading />, ssr: false }
);

/** Pas de SSR : le module embarque l’import wizard (xlsx) — le pré-rendu serveur peut planter → écran blanc. */
const BaseClientsPage = dynamic(
  () => import('@/components/banano/base-clients-page').then((m) => ({ default: m.BaseClientsPage })),
  { loading: () => <WhatsappReviewTabLoading />, ssr: false }
);

/** Pas de SSR : sous-arbre client lourd (fidélité, équipe, portails) évite erreurs d’hydratation removeChild. */
const BananoParametresPanel = dynamic(
  () =>
    import('@/components/banano/banano-parametres-panel').then((m) => ({
      default: m.BananoParametresPanel,
    })),
  { loading: () => <WhatsappReviewTabLoading />, ssr: false }
);

/**
 * Panneau Paramètres uniquement après montage client : le fallback `next/dynamic` + chunk
 * ne passent plus par l’hydratation initiale (réduit fortement les erreurs removeChild avec next-intl).
 */
function ParametresMountGate() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <WhatsappReviewTabLoading />;
  }
  return <BananoParametresPanel />;
}

const BananoSentinelLiveFeed = dynamic(
  () =>
    import('@/components/banano/banano-sentinel-live-feed').then((m) => ({
      default: m.BananoSentinelLiveFeed,
    })),
  { loading: () => <WhatsappReviewTabLoading /> }
);

const TransactionFlowPanel = dynamic(
  () =>
    import('@/components/dashboard/transaction-flow-panel').then((m) => ({
      default: m.TransactionFlowPanel,
    })),
  { loading: () => <WhatsappReviewTabLoading />, ssr: false }
);

/** Intent « commerce physique » : sélecteur Collecte ou brouillon session avant enregistrement. */
function hasPhysicalStoreIntent(live: string | null, draftRaw: string | null): boolean {
  if (live && live !== 'ecommerce') return true;
  if (draftRaw && draftRaw !== 'ecommerce') return true;
  return false;
}

/**
 * `useSearchParams()` doit être sous `Suspense` (App Router) pour éviter écran vide /
 * « missing required error components » en navigation client.
 */
export default function WhatsappReviewPage() {
  return (
    <Suspense fallback={<WhatsappReviewTabLoading />}>
      <WhatsappReviewPageInner />
    </Suspense>
  );
}

function WhatsappReviewPageInner() {
  const t = useTranslations('Dashboard.whatsappReviewMeta');
  const tSidebar = useTranslations('Dashboard.sidebar');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** Catégorie enregistrée en base (refetch uniquement — jamais écrasée par le refetch hors navigation Collecte). */
  const [serverBusinessCategory, setServerBusinessCategory] = useState<string | null>(null);
  /**
   * Sélection courante dans Collecte (callback) — peut différer du serveur tant que non enregistré.
   */
  const [liveBusinessCategory, setLiveBusinessCategory] = useState<string | null>(null);
  const [whatsappReviewUserId, setWhatsappReviewUserId] = useState<string | null>(null);

  const refetchBusinessCategoryFromServer = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setServerBusinessCategory(null);
      setWhatsappReviewUserId(null);
      return;
    }
    setWhatsappReviewUserId(user.id);
    const { data } = await supabase
      .from('profiles')
      .select('business_category')
      .eq('id', user.id)
      .maybeSingle();
    setServerBusinessCategory(data?.business_category ?? null);
  }, []);

  const onActivityCategoryLiveChange = useCallback((categoryKey: string) => {
    setLiveBusinessCategory(categoryKey);
  }, []);

  const draftCategory = whatsappReviewUserId
    ? readActivityProfileDraftCategory(whatsappReviewUserId)
    : null;
  const whatsappReviewOnlineOnly =
    serverBusinessCategory === 'ecommerce' &&
    !hasPhysicalStoreIntent(liveBusinessCategory, draftCategory);

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    if (tab === 'collecte' || tab === 'avis') return 'collecte';
    if (tab === 'parametres') return 'parametres';
    /** Ancien lien / deeplink `?tab=elite` → même vue que Pilotage (voir useEffect de normalisation URL). */
    if (tab === 'pilotage' || tab === 'elite') return 'pilotage';
    /** Anciens liens automations / push → même vue que Paramètres (voir useEffect de normalisation URL). */
    if (tab === 'automations' || tab === 'push' || tab === 'wallet-push') return 'parametres';
    if (tab === 'wallet-design' || tab === 'wallet') return 'wallet-design';
    if (tab === 'flux' || tab === 'flow') return 'flux';
    if (tab === 'sentinel') return 'sentinel';
    if (tab === 'clients' || searchParams.get('member')) return 'clients';
    return 'collecte';
  }, [searchParams]);

  /** Garde le pilotage monté après la 1ʳᵉ visite : évite reload + saut en haut entre onglets. */
  const [pilotageKeepAlive, setPilotageKeepAlive] = useState(() => activeTab === 'pilotage');
  useEffect(() => {
    if (activeTab === 'pilotage') setPilotageKeepAlive(true);
  }, [activeTab]);

  const pilotageScrollYRef = useRef(0);
  const prevActiveTabRef = useRef<typeof activeTab | null>(null);
  useEffect(() => {
    const prev = prevActiveTabRef.current;
    if (prev === 'pilotage' && activeTab !== 'pilotage') {
      pilotageScrollYRef.current = window.scrollY;
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  useLayoutEffect(() => {
    if (activeTab !== 'pilotage') return;
    const y = pilotageScrollYRef.current;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [activeTab]);

  useEffect(() => {
    void refetchBusinessCategoryFromServer();
  }, [refetchBusinessCategoryFromServer]);

  useEffect(() => {
    if (searchParams.get('tab') !== 'fidelite') return;
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'collecte');
    p.delete('member');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (searchParams.get('tab') !== 'elite') return;
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'pilotage');
    p.delete('member');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab !== 'automations' && tab !== 'push' && tab !== 'wallet-push') return;
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'parametres');
    p.delete('member');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (whatsappReviewOnlineOnly !== true) return;
    if (activeTab === 'collecte') return;
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'collecte');
    p.delete('member');
    router.replace(`${pathname}?${p.toString()}`);
  }, [whatsappReviewOnlineOnly, activeTab, pathname, router, searchParams]);

  const setTab = useCallback(
    (
      next:
        | 'clients'
        | 'parametres'
        | 'pilotage'
        | 'collecte'
        | 'sentinel'
        | 'flux'
        | 'wallet-design'
    ) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next === 'collecte') {
        p.set('tab', 'collecte');
        p.delete('member');
      } else if (next === 'clients') {
        p.set('tab', 'clients');
      } else if (next === 'parametres') {
        p.set('tab', 'parametres');
        p.delete('member');
      } else if (next === 'pilotage') {
        p.set('tab', 'pilotage');
        p.delete('member');
      } else if (next === 'wallet-design') {
        p.set('tab', 'wallet-design');
        p.delete('member');
      } else if (next === 'flux') {
        p.set('tab', 'flux');
        p.delete('member');
      } else if (next === 'sentinel') {
        p.set('tab', 'sentinel');
        p.delete('member');
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const shellMaxWidthClass =
    activeTab === 'flux' ? 'max-w-[1600px]' : activeTab === 'wallet-design' ? 'max-w-[1400px]' : 'max-w-6xl';

  return (
    <div
      className={`${shellMaxWidthClass} mx-auto min-w-0 w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-5`}
    >
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-50">
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {whatsappReviewOnlineOnly === true ? t('pageSubtitleEcommerce') : t('pageSubtitleFull')}
        </p>
      </div>

      {whatsappReviewOnlineOnly !== true ? (
      <nav
        aria-label={t('tabsNavAria')}
        className="flex flex-wrap p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 gap-1"
      >
        <button
          type="button"
          onClick={() => setTab('collecte')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'collecte'
              ? 'bg-white dark:bg-zinc-950 text-[#2563eb] shadow-sm border border-slate-200/90 dark:border-zinc-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          {t('tabCollecte')}
        </button>
        <button
          type="button"
          onClick={() => setTab('pilotage')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'pilotage'
              ? 'bg-white dark:bg-zinc-950 text-[#2563eb] shadow-sm border border-slate-200/90 dark:border-zinc-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          {t('tabPilotage')}
        </button>
        <button
          type="button"
          onClick={() => setTab('wallet-design')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'wallet-design'
              ? 'bg-white dark:bg-zinc-950 text-[#2563eb] shadow-sm border border-slate-200/90 dark:border-zinc-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          {t('tabWalletDesign')}
        </button>
        <button
          type="button"
          onClick={() => setTab('flux')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'flux'
              ? 'bg-white dark:bg-zinc-950 text-[#2563eb] shadow-sm border border-slate-200/90 dark:border-zinc-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Activity className="w-4 h-4 shrink-0" />
          {tSidebar('flowAnalytics')}
        </button>
        <button
          type="button"
          onClick={() => setTab('sentinel')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'sentinel'
              ? 'bg-white dark:bg-zinc-950 text-[#2563eb] shadow-sm border border-slate-200/90 dark:border-zinc-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Radar className="w-4 h-4 shrink-0" />
          {t('tabSentinel')}
        </button>
        <button
          type="button"
          onClick={() => setTab('clients')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'clients'
              ? 'bg-white dark:bg-zinc-950 text-[#2563eb] shadow-sm border border-slate-200/90 dark:border-zinc-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          {t('tabClients')}
        </button>
        <button
          type="button"
          onClick={() => setTab('parametres')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'parametres'
              ? 'bg-white dark:bg-zinc-950 text-[#2563eb] shadow-sm border border-slate-200/90 dark:border-zinc-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          {t('tabParametres')}
        </button>
      </nav>
      ) : null}

      {activeTab === 'collecte' ? (
        <CollecteAvisPage
          pageVariant={COLLECTE_PAGE_VARIANT_WHATSAPP_REVIEW}
          onActivityProfileSaved={refetchBusinessCategoryFromServer}
          onActivityCategoryLiveChange={onActivityCategoryLiveChange}
        />
      ) : null}

      {pilotageKeepAlive || activeTab === 'pilotage' ? (
        <div
          className={activeTab === 'pilotage' ? 'block' : 'hidden'}
          aria-hidden={activeTab !== 'pilotage'}
        >
          <BananoOmnipresentDashboard />
        </div>
      ) : null}

      {activeTab === 'wallet-design' ? <WalletDesignerPanel /> : null}

      {activeTab === 'flux' ? (
        <div className="relative z-10 min-w-0 -mx-1 sm:mx-0">
          <TransactionFlowPanel />
        </div>
      ) : null}

      {activeTab === 'sentinel' ? <BananoSentinelLiveFeed /> : null}

      {activeTab === 'clients' ? (
        <BananoClientsErrorBoundary>
          <Suspense fallback={<WhatsappReviewTabLoading />}>
            <BaseClientsPage embedded />
          </Suspense>
        </BananoClientsErrorBoundary>
      ) : null}

      {activeTab === 'parametres' ? <ParametresMountGate /> : null}
    </div>
  );
}
