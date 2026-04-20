'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  POST_DELIVERY_CUSTOM_MAX,
  POST_DELIVERY_CUSTOM_MIN,
} from '@/lib/webhooks/ecommerce-ingest';
import { createClient } from '@/lib/supabase/client';
import { toPlanSlug } from '@/lib/feature-gate';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { DashboardInlineLoading } from '@/components/dashboard/dashboard-inline-loading';
import { toast } from 'sonner';
import {
  clearActivityProfileDraft,
  readActivityProfileDraftCategory,
  writeActivityProfileDraft,
} from '@/lib/collecte/activity-profile-draft';
import {
  Copy, Eye, EyeOff, CheckCircle2, Lock, Loader2,
  MessageCircle, Zap, RefreshCw, FileDown, FileText,
  Users, MessageSquare, UserX, Star, Clock, Activity,
  Scale, Info, ClipboardList,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  subscription_plan: string | null;
  selected_plan: string | null;
  establishment_name: string | null;
  google_review_url: string | null;
  webhook_token: string | null;
  api_key: string | null;
  webhook_send_delay_minutes: number | null;
  business_category: string | null;
  /** Après statut Livré : préréglages ou custom + minutes dédiées */
  ecommerce_delivery_strategy: 'immediate_pleasure' | 'test_mount' | 'custom' | null;
  ecommerce_post_delivery_custom_minutes: number | null;
  /** Portail légal — requis pour webhooks / ressources légales connectées. */
  legal_compliance_accepted?: boolean | null;
  legal_compliance_accepted_at?: string | null;
  legal_compliance_accepted_legal_version?: number | null;
  last_legal_agreement_version?: number | null;
  /** Aligné sur le profil d'activité : ecommerce → online, sinon physical (voir migration 082). */
  business_type?: 'physical' | 'online' | null;
  /** Langue compte (affiche PDF, liens légaux). */
  language?: string | null;
};

/** Funnel de conversion Zenith pour la période sélectionnée. */
type QueueStats = {
  /** Total d'entrées (flux entrant) */
  total: number;
  /** Clients ayant répondu OUI (conversation_state IS NOT NULL) */
  engaged: number;
  /** Clients ayant répondu NON / STOP (status = 'cancelled') */
  cancelled: number;
  /** Avis sublimés et publiés (conversation_state = 'published') */
  published: number;
  /** Messages en attente d'envoi (status = 'pending') */
  pending: number;
};

type TimeRange = '7d' | '30d' | '6m' | 'all';

const ACTIVITY_PROFILE_KEYS = [
  'restaurant',
  'bakery',
  'beauty',
  'garage',
  'hotel',
  'artisan',
  'fast_service',
  'custom',
  'ecommerce',
] as const;

/** Retourne la date ISO du début de la période, ou null pour "tout le temps". */
function getDateCutoff(range: TimeRange): string | null {
  const now = new Date();
  switch (range) {
    case '7d':  return new Date(now.getTime() -   7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d': return new Date(now.getTime() -  30 * 24 * 60 * 60 * 1000).toISOString();
    case '6m':  return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
    case 'all': return null;
  }
}

/** Masquage léger du téléphone dans le journal (le commerçant garde l’accès brut en base / export). */
function maskPhoneForAudit(phone: string): string {
  const t = (phone ?? '').replace(/\s/g, '');
  if (t.length <= 5) return '•••••';
  return `${t.slice(0, 4)}…${t.slice(-2)}`;
}


type AuditQueueRow = {
  id: string;
  first_name: string;
  phone: string;
  source_info: string | null;
  status: string;
  scheduled_at: string;
  created_at: string;
  sent_at: string | null;
  metadata: Record<string, unknown> | null;
};

type ConsentAuditRow = {
  id: string;
  created_at: string;
  consent_type: string;
  channel: string;
  message_preview: string | null;
  review_queue_id: string | null;
};

type ActivityProfile = {
  key: string;
  label: string;
  targetMinutes: number | null;  // null = personnalisé
  example: string;
};

/** Champs profil alignés sur l&apos;UPDATE Supabase (hors conformité légale). */
type ProfilePersistFields = {
  webhook_send_delay_minutes: number;
  business_category: string;
  business_type: 'physical' | 'online';
  ecommerce_delivery_strategy: 'immediate_pleasure' | 'test_mount' | 'custom';
  ecommerce_post_delivery_custom_minutes: number | null;
};

function computeProfilePersistFields(
  activityProfile: ActivityProfile,
  customMinutes: number,
  ecommerceDeliveryStrategy: 'immediate_pleasure' | 'test_mount' | 'custom',
  ecommercePostDeliveryCustomInput: string,
  ecommercePostDeliveryCustomMinutes: number
): ProfilePersistFields {
  const effectiveMinutes =
    activityProfile.key === 'custom'
      ? customMinutes
      : (activityProfile.targetMinutes ?? 30);
  const strategyForDb =
    activityProfile.key === 'ecommerce' ? ecommerceDeliveryStrategy : 'immediate_pleasure';
  const rawCustom = ecommercePostDeliveryCustomInput.trim();
  const parsedCustom = parseInt(rawCustom, 10);
  const customMinutesForDb =
    activityProfile.key === 'ecommerce' && ecommerceDeliveryStrategy === 'custom'
      ? clampEcommercePostDeliveryMinutes(
          rawCustom === '' || Number.isNaN(parsedCustom)
            ? ecommercePostDeliveryCustomMinutes
            : parsedCustom
        )
      : null;
  const businessTypeForDb: 'physical' | 'online' =
    activityProfile.key === 'ecommerce' ? 'online' : 'physical';
  return {
    webhook_send_delay_minutes: effectiveMinutes,
    business_category: activityProfile.key,
    business_type: businessTypeForDb,
    ecommerce_delivery_strategy: strategyForDb,
    ecommerce_post_delivery_custom_minutes: customMinutesForDb,
  };
}

function normDbMinutes(n: number | null | undefined): number | null {
  if (n === null || n === undefined || typeof n !== 'number' || Number.isNaN(n)) return null;
  return n;
}

function profileMatchesPersistFields(p: Profile, f: ProfilePersistFields): boolean {
  const strat = (p.ecommerce_delivery_strategy ?? 'immediate_pleasure') as ProfilePersistFields['ecommerce_delivery_strategy'];
  return (
    (p.business_category ?? null) === f.business_category &&
    (p.webhook_send_delay_minutes ?? null) === f.webhook_send_delay_minutes &&
    (p.business_type ?? null) === f.business_type &&
    strat === f.ecommerce_delivery_strategy &&
    normDbMinutes(p.ecommerce_post_delivery_custom_minutes) === normDbMinutes(f.ecommerce_post_delivery_custom_minutes)
  );
}

/** Brouillon local : stockage partagé avec `lib/collecte/activity-profile-draft` (ex. Banano). */
function readActivityProfileDraft(userId: string): string | null {
  const key = readActivityProfileDraftCategory(userId);
  if (!key || !(ACTIVITY_PROFILE_KEYS as readonly string[]).includes(key)) return null;
  return key;
}

function clampEcommercePostDeliveryMinutes(m: number): number {
  return Math.min(POST_DELIVERY_CUSTOM_MAX, Math.max(POST_DELIVERY_CUSTOM_MIN, Math.round(m)));
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reputexa.fr';

/** Clés i18n des listes RGPD (hors JSX pour le linter). */
const RGPD_SHOPIFY_LI_KEYS = ['rgpdShopifyLi1', 'rgpdShopifyLi2', 'rgpdShopifyLi3', 'rgpdShopifyLi4'] as const;
const RGPD_STRIPE_LI_KEYS = ['rgpdStripeLi1', 'rgpdStripeLi2', 'rgpdStripeLi3', 'rgpdStripeLi4'] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm p-5 flex items-start gap-4">
      <div className={`rounded-xl p-2.5 shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CopyButton({
  value,
  copyLabel,
  copiedLabel,
  title,
}: {
  value: string;
  copyLabel: string;
  copiedLabel: string;
  /** Titre du bouton (accessibilité). */
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
      title={title}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? copiedLabel : copyLabel}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export type CollecteAvisPageVariant = 'collecte-avis' | 'whatsapp-review';

type CollecteAvisPageProps = {
  /**
   * Review WhatsApp : contenu collecte embarqué (webhook pour tous les profils, même commerce physique).
   */
  pageVariant?: CollecteAvisPageVariant;
  /** Ex. recharger le bandeau du module quand le profil d&apos;activité est enregistré. */
  onActivityProfileSaved?: () => void;
  /**
   * Review WhatsApp : à chaque changement du menu « Profil d&apos;activité » (sans attendre la sauvegarde),
   * pour afficher ou masquer les onglets fidélité / pilotage / CRM.
   */
  onActivityCategoryLiveChange?: (categoryKey: string) => void;
};

export function CollecteAvisPage({
  pageVariant = 'collecte-avis',
  onActivityProfileSaved,
  onActivityCategoryLiveChange,
}: CollecteAvisPageProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Dashboard.reviewCollection');

  const activityProfiles = useMemo((): ActivityProfile[] => {
    const prof = (
      key:
        | 'restaurant'
        | 'bakery'
        | 'beauty'
        | 'garage'
        | 'hotel'
        | 'artisan'
        | 'fast_service'
        | 'custom'
        | 'ecommerce',
      targetMinutes: number | null
    ) => ({
      key,
      label: t(`profiles.${key}.label`),
      targetMinutes,
      example: t(`profiles.${key}.example`),
    });
    return [
      prof('restaurant', 45),
      prof('bakery', 120),
      prof('beauty', 180),
      prof('garage', 1440),
      prof('hotel', 120),
      prof('artisan', 240),
      prof('fast_service', 20),
      prof('custom', null),
      prof('ecommerce', 120),
    ];
  }, [t]);

  const [activityKey, setActivityKey] = useState<string>('restaurant');
  const activityProfile = useMemo(
    () => activityProfiles.find((p) => p.key === activityKey) ?? activityProfiles[0],
    [activityProfiles, activityKey]
  );

  const profileFromMinutesResolved = useCallback(
    (minutes: number | null): ActivityProfile => {
      const custom = activityProfiles.find((p) => p.key === 'custom')!;
      if (minutes === null) return custom;
      return activityProfiles.find((p) => p.targetMinutes === minutes) ?? custom;
    },
    [activityProfiles]
  );

  const timeRangeOptions = useMemo(
    () =>
      [
        { value: '7d' as const, label: t('timeRange7d') },
        { value: '30d' as const, label: t('timeRange30d') },
        { value: '6m' as const, label: t('timeRange6m') },
        { value: 'all' as const, label: t('timeRangeAll') },
      ] as const,
    [t]
  );

  const ingressLabel = useCallback(
    (metadata: Record<string, unknown> | null | undefined) => {
      const v = metadata?.ingress;
      if (v === 'api_key') return t('ingressApiKey');
      if (v === 'zenith_token') return t('ingressZenith');
      return t('ingressDefault');
    },
    [t]
  );

  const queueStatusLabelFn = useCallback(
    (status: string) => {
      switch (status) {
        case 'pending':
          return t('queuePending');
        case 'sent':
          return t('queueSent');
        case 'failed':
          return t('queueFailed');
        case 'cancelled':
          return t('queueCancelled');
        default:
          return status;
      }
    },
    [t]
  );

  const consentTypeLabelFn = useCallback(
    (c: string) => {
      switch (c) {
        case 'yes':
          return t('consentYes');
        case 'no':
          return t('consentNo');
        case 'stop':
          return t('consentStop');
        default:
          return c;
      }
    },
    [t]
  );

  const formatDelayLabel = useCallback(
    (minutes: number) => {
      if (minutes >= 1440) return t('delayNextDay');
      if (minutes < 60) return t('delayMinutes', { count: minutes });
      if (minutes === 60) return t('delayOneHour');
      return t('delayHours', { count: Math.round(minutes / 60) });
    },
    [t]
  );

  /** Délai après scan « Livré » (e-commerce), libellé localisé (min / h). */
  const formatPostDeliveryMinutesLabel = useCallback(
    (minutes: number) => {
      const m = clampEcommercePostDeliveryMinutes(minutes);
      if (m < 60) return t('postDelayMinutesShort', { count: m });
      const h = Math.floor(m / 60);
      const rem = m % 60;
      if (rem === 0) return t('postDelayHoursWhole', { count: h });
      return t('postDelayHoursMinutes', { hours: h, minutes: rem });
    },
    [t]
  );

  /** Webhook JSON examples: built in code (ICU cannot safely embed `{` / `}` blocks). */
  const ecommerceWebhookExample = useMemo(() => {
    const keyPh = t('keyPlaceholder');
    const sample = t('webhookEcommerceSampleLastPurchase');
    const first = t('webhookExampleFirstName');
    const phone = t('webhookExamplePhone');
    const status = t('webhookEcommerceExampleStatus');
    const tracking = t('webhookEcommerceExampleTracking');
    const source = t('webhookEcommerceExampleSource');
    return [
      `POST ${SITE_URL}/api/webhooks/${keyPh}`,
      'Content-Type: application/json',
      '',
      '{',
      `  "first_name":       ${JSON.stringify(first)},`,
      `  "phone":            ${JSON.stringify(phone)},`,
      `  "last_purchase":    ${JSON.stringify(sample)},`,
      `  "status":           ${JSON.stringify(status)},`,
      '  "whatsapp_consent": true,',
      `  "tracking_number":  ${JSON.stringify(tracking)},`,
      `  "source_info":      ${JSON.stringify(source)}`,
      '}',
    ].join('\n');
  }, [t]);

  const physicalWebhookExample = useMemo(() => {
    const keyPh = t('keyPlaceholder');
    const comment = t('webhookPhysicalCodeNote');
    const sample = t('webhookPhysicalSampleLastPurchase');
    const first = t('webhookExampleFirstName');
    const phone = t('webhookExamplePhone');
    return [
      `POST ${SITE_URL}/api/webhooks/${keyPh}`,
      'Content-Type: application/json',
      '',
      '{',
      `  "first_name":    ${JSON.stringify(first)},`,
      `  "phone":         ${JSON.stringify(phone)},`,
      `  "last_purchase": ${JSON.stringify(sample)}    ${comment}`,
      '}',
    ].join('\n');
  }, [t]);

  const dateLocaleTag =
    locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : locale === 'pt' ? 'pt-PT' : locale;

  // ── State ──────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [showToken, setShowToken] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [generatingPoster, setGeneratingPoster] = useState(false);
  /** Délai après statut « Livré » (e-commerce) */
  const [ecommerceDeliveryStrategy, setEcommerceDeliveryStrategy] = useState<
    'immediate_pleasure' | 'test_mount' | 'custom'
  >('immediate_pleasure');
  /** Utilisé si stratégie = custom (minutes après scan Livré). */
  const [ecommercePostDeliveryCustomMinutes, setEcommercePostDeliveryCustomMinutes] = useState(120);
  /** Saisie libre (chaîne) : le clamp min/max n’est appliqué qu’au blur / enregistrement. */
  const [ecommercePostDeliveryCustomInput, setEcommercePostDeliveryCustomInput] = useState('120');
  /** Onglets d'aide RGPD : Shopify vs Stripe */
  const [ecommerceConsentHelpTab, setEcommerceConsentHelpTab] = useState<'shopify' | 'stripe'>('shopify');

  /** Rappel CGV : switch vers profil e-commerce OU confirmation avant sauvegarde. */
  const [showEcommerceCgvModal, setShowEcommerceCgvModal] = useState(false);

  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const [auditRows, setAuditRows] = useState<AuditQueueRow[]>([]);
  const [consentAuditRows, setConsentAuditRows] = useState<ConsentAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  /** Évite d&apos;écrire en base au chargement (brouillon ≠ profil serveur) tant que l&apos;utilisateur n&apos;a rien modifié. */
  const userTouchedConfigRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isZenith =
    profile !== null &&
    toPlanSlug(profile.subscription_plan, profile.selected_plan) === 'zenith';

  // ── Data fetching ──────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('profiles')
      .select('id, subscription_plan, selected_plan, establishment_name, google_review_url, webhook_token, api_key, webhook_send_delay_minutes, business_category, business_type, ecommerce_delivery_strategy, ecommerce_post_delivery_custom_minutes, legal_compliance_accepted, language')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      userTouchedConfigRef.current = false;
      setProfile(data as Profile);
      // Priorité : business_category persiste la sélection du profil activité
      const savedCategory = (data.business_category as string | null) ?? null;
      const savedMinutes  = (data.webhook_send_delay_minutes as number | null) ?? 45;
      const matchedByCategory = savedCategory
        ? activityProfiles.find((p) => p.key === savedCategory)
        : null;
      let resolved = matchedByCategory ?? profileFromMinutesResolved(savedMinutes);
      const draftKey = readActivityProfileDraft(user.id);
      if (draftKey) {
        const fromDraft = activityProfiles.find((p) => p.key === draftKey);
        if (fromDraft) resolved = fromDraft;
      }
      setActivityKey(resolved.key);
      if (pageVariant === 'whatsapp-review') onActivityCategoryLiveChange?.(resolved.key);
      if (resolved.key === 'custom') setCustomMinutes(savedMinutes);
      const strat = (data as Profile).ecommerce_delivery_strategy;
      if (strat === 'test_mount') setEcommerceDeliveryStrategy('test_mount');
      else if (strat === 'custom') {
        setEcommerceDeliveryStrategy('custom');
        const cm = (data as Profile).ecommerce_post_delivery_custom_minutes;
        const clamped = clampEcommercePostDeliveryMinutes(typeof cm === 'number' ? cm : 120);
        setEcommercePostDeliveryCustomMinutes(clamped);
        setEcommercePostDeliveryCustomInput(String(clamped));
      } else {
        setEcommerceDeliveryStrategy('immediate_pleasure');
      }
    }
    setLoading(false);
  }, [onActivityCategoryLiveChange, pageVariant, activityProfiles, profileFromMinutesResolved]);


  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatsLoading(false); return; }

    const cutoff = getDateCutoff(timeRange);

    let query = supabase
      .from('review_queue')
      .select('status, conversation_state')
      .eq('user_id', user.id);

    if (cutoff) query = query.gte('created_at', cutoff);

    const { data } = await query;

    if (data) {
      type Row = { status: string; conversation_state: string | null };
      const rows = data as Row[];

      setStats({
        total:     rows.length,
        engaged:   rows.filter((r) => r.conversation_state !== null).length,
        cancelled: rows.filter((r) => r.status === 'cancelled').length,
        published: rows.filter((r) => r.conversation_state === 'published').length,
        pending:   rows.filter((r) => r.status === 'pending').length,
      });
    }
    setStatsLoading(false);
  }, [timeRange]);

  const loadAuditTables = useCallback(async () => {
    if (!isZenith) {
      setAuditRows([]);
      setConsentAuditRows([]);
      setAuditLoading(false);
      return;
    }
    setAuditLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAuditLoading(false);
      return;
    }
    const cutoff = getDateCutoff(timeRange);

    let rq = supabase
      .from('review_queue')
      .select('id, first_name, phone, source_info, status, scheduled_at, created_at, sent_at, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(75);
    if (cutoff) rq = rq.gte('created_at', cutoff);

    let cq = supabase
      .from('consent_logs')
      .select('id, created_at, consent_type, channel, message_preview, review_queue_id')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40);
    if (cutoff) cq = cq.gte('created_at', cutoff);

    const [queueRes, consentRes] = await Promise.all([rq, cq]);

    if (queueRes.error) {
      console.warn('review_queue audit fetch', queueRes.error);
    }
    if (consentRes.error) {
      console.warn('consent_logs audit fetch', consentRes.error);
    }

    setAuditRows((queueRes.data ?? []) as AuditQueueRow[]);
    setConsentAuditRows((consentRes.data ?? []) as ConsentAuditRow[]);
    setAuditLoading(false);
  }, [timeRange, isZenith]);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => { loadStats();   }, [loadStats]);
  useEffect(() => { void loadAuditTables(); }, [loadAuditTables]);

  // Modale e-commerce : seul le bouton d'engagement ferme — pas d'Échap
  useEffect(() => {
    if (!showEcommerceCgvModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [showEcommerceCgvModal]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const effectiveMinutes =
    activityProfile.key === 'custom'
      ? customMinutes
      : (activityProfile.targetMinutes ?? 30);

  /** Exécute la sauvegarde réelle (délai, catégorie, stratégie e-commerce, conformité). */
  const doActualSave = async (opts?: { silent?: boolean }) => {
    if (!profile) return;
    const silent = opts?.silent === true;
    const fields = computeProfilePersistFields(
      activityProfile,
      customMinutes,
      ecommerceDeliveryStrategy,
      ecommercePostDeliveryCustomInput,
      ecommercePostDeliveryCustomMinutes
    );
    setSaving(true);
    const supabase = createClient();

    let legalVersion = 0;
    try {
      const vRes = await fetch('/api/legal/latest-version');
      const vJson = (await vRes.json().catch(() => ({}))) as { version?: number };
      legalVersion = typeof vJson.version === 'number' ? vJson.version : 0;
    } catch {
      /* fallback 0 */
    }
    const complianceNow = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        webhook_send_delay_minutes: fields.webhook_send_delay_minutes,
        business_category: fields.business_category,
        business_type: fields.business_type,
        ecommerce_delivery_strategy: fields.ecommerce_delivery_strategy,
        ecommerce_post_delivery_custom_minutes: fields.ecommerce_post_delivery_custom_minutes,
        legal_compliance_accepted: true,
        legal_compliance_accepted_at: complianceNow,
        legal_compliance_accepted_legal_version: legalVersion,
        last_legal_agreement_version: legalVersion,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(t('toastSaveError'));
    } else {
      if (!silent) {
        toast.success(t('toastSaveOk'));
      }
      if (
        activityProfile.key === 'ecommerce' &&
        ecommerceDeliveryStrategy === 'custom' &&
        fields.ecommerce_post_delivery_custom_minutes !== null
      ) {
        setEcommercePostDeliveryCustomMinutes(fields.ecommerce_post_delivery_custom_minutes);
        setEcommercePostDeliveryCustomInput(String(fields.ecommerce_post_delivery_custom_minutes));
      }
      setProfile((p) => p ? {
        ...p,
        webhook_send_delay_minutes: fields.webhook_send_delay_minutes,
        business_category: fields.business_category,
        business_type: fields.business_type,
        ecommerce_delivery_strategy: fields.ecommerce_delivery_strategy,
        ecommerce_post_delivery_custom_minutes: fields.ecommerce_post_delivery_custom_minutes,
        legal_compliance_accepted: true,
        legal_compliance_accepted_at: complianceNow,
        legal_compliance_accepted_legal_version: legalVersion,
        last_legal_agreement_version: legalVersion,
      } : p);
      clearActivityProfileDraft();
      if (pageVariant === 'whatsapp-review') onActivityCategoryLiveChange?.(activityProfile.key);
      onActivityProfileSaved?.();
      router.refresh();
    }
    setSaving(false);
  };

  /**
   * Clic sur "Enregistrer les modifications".
   * Sauvegarde directe pour tous les profils (y compris e-commerce : stratégie après livraison, délais, etc.).
   * Le pop-up d’engagement e-commerce ne s’affiche que lors du passage à « Boutique en ligne » dans le sélecteur Profil d’activité.
   */
  const handleSaveConfig = () => {
    doActualSave();
  };

  const doActualSaveRef = useRef(doActualSave);
  doActualSaveRef.current = doActualSave;

  useEffect(() => {
    if (loading || !profile || !isZenith || showEcommerceCgvModal || saving) return;
    if (!userTouchedConfigRef.current) return;

    const fields = computeProfilePersistFields(
      activityProfile,
      customMinutes,
      ecommerceDeliveryStrategy,
      ecommercePostDeliveryCustomInput,
      ecommercePostDeliveryCustomMinutes
    );
    if (profileMatchesPersistFields(profile, fields)) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      void doActualSaveRef.current({ silent: true });
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    loading,
    profile,
    isZenith,
    showEcommerceCgvModal,
    saving,
    activityProfile,
    customMinutes,
    ecommerceDeliveryStrategy,
    ecommercePostDeliveryCustomMinutes,
    ecommercePostDeliveryCustomInput,
  ]);

  const handleGenerateToken = async () => {
    if (!profile) return;
    setGeneratingToken(true);
    try {
      const res = await fetch('/api/profile/generate-webhook-token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('toastGenericError'));
      setProfile((p) => p ? { ...p, webhook_token: data.token } : p);
      toast.success(t('toastTokenOk'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toastTokenError'));
    }
    setGeneratingToken(false);
  };

  const handleGenerateApiKey = async () => {
    if (!profile) return;
    setGeneratingApiKey(true);
    try {
      const res = await fetch('/api/profile/generate-api-key', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('toastGenericError'));
      setProfile((p) => p ? { ...p, api_key: data.api_key } : p);
      toast.success(t('toastApiKeyOk'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toastApiKeyError'));
    }
    setGeneratingApiKey(false);
  };

  const renderAfficheRgpdSection = () => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
        {t('posterSectionLabel')}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            setGeneratingPoster(true);
            const pdfLocale = normalizeAppLocale(locale);
            const establishmentRaw =
              profile?.establishment_name?.trim() || t('posterDefaultEstablishment');
            const params = new URLSearchParams({
              establishmentName: establishmentRaw,
              paper: 'a4',
              locale: pdfLocale,
            });
            const downloadName = `${t('posterDownloadPrefix')}-${(profile?.establishment_name ?? t('establishmentFileFallback')).replace(/\s+/g, '-').slice(0, 30)}-a4.pdf`;
            try {
              const posterSignal =
                typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
                  ? AbortSignal.timeout(120_000)
                  : (() => {
                      const c = new AbortController();
                      setTimeout(() => c.abort(), 120_000);
                      return c.signal;
                    })();
              const res = await fetch(`/api/compliance-poster?${params.toString()}`, {
                credentials: 'same-origin',
                signal: posterSignal,
              });
              const ct = res.headers.get('Content-Type') ?? '';
              if (!res.ok) {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(err.error ?? t('toastGenericError'));
              }
              if (!ct.includes('application/pdf')) {
                throw new Error(t('toastPosterError'));
              }
              const blob = await res.blob();
              if (blob.size < 100) {
                throw new Error(t('toastPosterError'));
              }
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = downloadName;
              a.rel = 'noopener';
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              toast.success(t('toastPosterOk'));
            } catch (err) {
              const name = err instanceof Error ? err.name : '';
              if (name === 'AbortError' || name === 'TimeoutError') {
                toast.error(t('toastPosterError'));
              } else {
                toast.error(err instanceof Error ? err.message : t('toastPosterError'));
              }
            } finally {
              setGeneratingPoster(false);
            }
          }}
          disabled={
            generatingPoster ||
            !isZenith ||
            profile?.legal_compliance_accepted !== true
          }
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generatingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {t('posterGenerate')}
        </button>
      </div>
    </div>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return <DashboardInlineLoading />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-[#2563eb]" />
            {t('pageTitle')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t('pageSubtitle')}
          </p>
        </div>
        {isZenith && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 uppercase tracking-wide">
            <Zap className="w-3 h-3" /> {t('zenithBadge')}
          </span>
        )}
      </div>

      {/* ── Paywall overlay wrapper ─────────────────────────────────────── */}
      <div className="relative">
        {/* Blur overlay — non-Zenith users */}
        {!isZenith && profile && (
          <div className="absolute inset-0 z-20 rounded-2xl backdrop-blur-md bg-white/60 dark:bg-black/60 flex flex-col items-center justify-center text-center px-6 py-12 border border-slate-200 dark:border-zinc-800/50">
            <div className="text-6xl mb-4 select-none">🔒</div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              {t('paywallTitle')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-sm text-sm leading-relaxed">
              {t('paywallBody')}
            </p>
            <Link
              href="/upgrade"
              className="inline-flex items-center gap-2 bg-[#2563eb] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-[#2563eb]/25"
            >
              <Zap className="w-4 h-4" />
              {t('paywallCta')}
            </Link>
          </div>
        )}

        {/* ── Sections (blurred content for non-Zenith) ─────────────────── */}
        <div className={!isZenith ? 'pointer-events-none select-none' : 'pointer-events-auto'}>

          {/* ── Section 1 : Configuration ────────────────────────────────── */}
          <section className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm p-6 mb-6">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#2563eb]/10 text-[#2563eb] text-xs font-bold flex items-center justify-center">1</span>
              {t('section1Title')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
              {activityProfile.key === 'ecommerce' ? t('section1IntroEcommerce') : t('section1Intro')}
            </p>

            <div className="space-y-4">
              {/* Activity profile */}
              <div>
                <label htmlFor="activity-profile" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('activityLabel')}
                </label>
                <select
                  id="activity-profile"
                  value={activityProfile.key}
                  onChange={(e) => {
                    const found = activityProfiles.find((p) => p.key === e.target.value);
                    if (found) {
                      userTouchedConfigRef.current = true;
                      const prevKey = activityProfile.key;
                      setActivityKey(found.key);
                      if (pageVariant === 'whatsapp-review') onActivityCategoryLiveChange?.(found.key);
                      void (async () => {
                        const { data: { user: u } } = await createClient().auth.getUser();
                        if (u?.id) writeActivityProfileDraft(u.id, found.key);
                      })();
                      if (found.key === 'ecommerce' && prevKey !== 'ecommerce') {
                        setShowEcommerceCgvModal(true);
                      }
                    }
                  }}
                  className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all text-sm"
                >
                  {activityProfiles.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {t('businessTypeHint')}{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {activityProfile.key === 'ecommerce'
                      ? t('businessTypeOnline')
                      : t('businessTypePhysical')}
                  </span>
                  {' '}
                  {t('businessTypeColumn')}{' '}
                  <code className="text-[10px] bg-slate-100 dark:bg-zinc-800 px-1 rounded">{t('codeBusinessCategory')}</code>
                  {' / '}
                  <code className="text-[10px] bg-slate-100 dark:bg-zinc-800 px-1 rounded">{t('codeBusinessType')}</code>.
                </p>

                {activityProfile.key !== 'ecommerce' ? (
                  <p className="mt-2 text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-sky-200/80 dark:border-sky-900/45 bg-sky-50/60 dark:bg-sky-950/25 px-3 py-2.5 leading-snug">
                    <span className="font-semibold text-sky-900 dark:text-sky-200">
                      {t('activityProfileExampleCaption')}
                    </span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">{activityProfile.example}</span>
                  </p>
                ) : null}

                {/* Champ libre si Personnalisé */}
                {activityProfile.key === 'custom' && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <input
                      type="number"
                      min={5}
                      max={2880}
                      value={customMinutes}
                      onChange={(e) => {
                        userTouchedConfigRef.current = true;
                        setCustomMinutes(Math.max(5, Number(e.target.value)));
                      }}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all text-sm"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">{t('minutesUnit')}</span>
                  </div>
                )}

                {activityProfile.key === 'ecommerce' && (
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/40 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      {t('ecommerceStrategyTitle')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t('ecommerceStrategyIntro')}
                    </p>
                    <div className="flex flex-col gap-2 pt-1">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="ecommerce-strategy"
                          checked={ecommerceDeliveryStrategy === 'immediate_pleasure'}
                          onChange={() => {
                            userTouchedConfigRef.current = true;
                            setEcommerceDeliveryStrategy('immediate_pleasure');
                          }}
                          className="mt-0.5 accent-[#2563eb]"
                        />
                        <span className="text-sm text-slate-800 dark:text-slate-200">
                          {t('ecommerceStrategyImmediate')}
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="ecommerce-strategy"
                          checked={ecommerceDeliveryStrategy === 'test_mount'}
                          onChange={() => {
                            userTouchedConfigRef.current = true;
                            setEcommerceDeliveryStrategy('test_mount');
                          }}
                          className="mt-0.5 accent-[#2563eb]"
                        />
                        <span className="text-sm text-slate-800 dark:text-slate-200">
                          {t('ecommerceStrategyTestMount')}
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="ecommerce-strategy"
                          checked={ecommerceDeliveryStrategy === 'custom'}
                          onChange={() => {
                            userTouchedConfigRef.current = true;
                            setEcommerceDeliveryStrategy('custom');
                            setEcommercePostDeliveryCustomInput(String(ecommercePostDeliveryCustomMinutes));
                          }}
                          className="mt-0.5 accent-[#2563eb]"
                        />
                        <span className="text-sm text-slate-800 dark:text-slate-200">
                          {t('ecommerceStrategyCustom')}
                        </span>
                      </label>
                      {ecommerceDeliveryStrategy === 'custom' && (
                        <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-7 pt-1">
                          <label htmlFor="ecommerce-custom-minutes" className="text-sm text-slate-600 dark:text-slate-400">
                            {t('ecommerceCustomDelayLabel')}
                          </label>
                          <input
                            id="ecommerce-custom-minutes"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                            value={ecommercePostDeliveryCustomInput}
                            onChange={(e) => {
                              userTouchedConfigRef.current = true;
                              setEcommercePostDeliveryCustomInput(e.target.value);
                            }}
                            onBlur={() => {
                              const raw = ecommercePostDeliveryCustomInput.trim();
                              if (raw === '') {
                                setEcommercePostDeliveryCustomInput(String(ecommercePostDeliveryCustomMinutes));
                                return;
                              }
                              const n = parseInt(raw, 10);
                              if (Number.isNaN(n)) {
                                setEcommercePostDeliveryCustomInput(String(ecommercePostDeliveryCustomMinutes));
                                return;
                              }
                              const c = clampEcommercePostDeliveryMinutes(n);
                              setEcommercePostDeliveryCustomMinutes(c);
                              setEcommercePostDeliveryCustomInput(String(c));
                            }}
                            className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all text-sm"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t('ecommerceCustomRange', {
                              min: POST_DELIVERY_CUSTOM_MIN,
                              maxHours: Math.round(POST_DELIVERY_CUSTOM_MAX / 60),
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activityProfile.key === 'ecommerce' ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0 mt-px" aria-hidden />
                    <span className="block leading-relaxed">
                      {t.rich('ecommerceUxRich', {
                        lead: (chunks) => <strong>{chunks}</strong>,
                        mono: (chunks) => (
                          <code className="text-[10px] font-mono bg-slate-100 dark:bg-zinc-800 px-1 rounded">{chunks}</code>
                        ),
                      })}{' '}
                      {ecommerceDeliveryStrategy === 'immediate_pleasure'
                        ? t('ecommerceUxSend2h')
                        : ecommerceDeliveryStrategy === 'test_mount'
                          ? t('ecommerceUxSend24h')
                          : t('ecommerceUxSendCustom', {
                            delay: formatPostDeliveryMinutesLabel(ecommercePostDeliveryCustomMinutes),
                          })}{' '}
                      {t('ecommerceUxShippedOnly')}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving || !isZenith}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t('saveButton')}
              </button>
            </div>
          </section>

          {activityProfile.key === 'ecommerce' && (
            <section
              className="rounded-2xl border border-slate-200/90 dark:border-zinc-700/80 bg-slate-50/90 dark:bg-zinc-900/40 ring-1 ring-black/[0.03] dark:ring-white/[0.04] shadow-sm p-6 mb-6"
              aria-labelledby="rgpd-compliance-heading"
            >
              <h2
                id="rgpd-compliance-heading"
                className="font-semibold text-slate-900 dark:text-slate-100 text-[15px] mb-2 flex items-center gap-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-zinc-800 ring-1 ring-slate-200/80 dark:ring-zinc-700/60 shrink-0">
                  <Scale className="w-4 h-4 text-slate-600 dark:text-slate-300" aria-hidden />
                </span>
                {t('rgpdSectionTitle')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                {t('rgpdSectionIntro')}
              </p>

              <div className="rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-white/90 dark:bg-zinc-900/80 p-4 mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                  {t('rgpdConsentCopyLabel')}
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-3">
                  {t('rgpdConsentBody', {
                    establishment: profile?.establishment_name?.trim() || t('rgpdYourShopFallback'),
                  })}
                </p>
                <CopyButton
                  value={t('rgpdConsentBody', {
                    establishment: profile?.establishment_name?.trim() || t('rgpdYourShopFallback'),
                  })}
                  copyLabel={t('copyConsentButton')}
                  copiedLabel={t('copiedVerb')}
                  title={t('copyTitle', { item: t('copyItemConsentText') })}
                />
              </div>

              <div className="rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-white/90 dark:bg-zinc-900/80 p-4 mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                  {t('rgpdHelpTabsLabel')}
                </p>
                <div
                  className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 mb-4"
                  role="tablist"
                  aria-label={t('rgpdHelpTabsAria')}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={ecommerceConsentHelpTab === 'shopify'}
                    onClick={() => setEcommerceConsentHelpTab('shopify')}
                    className={`flex-1 min-w-[160px] px-3 py-2.5 rounded-lg text-xs font-semibold text-center transition-colors ${
                      ecommerceConsentHelpTab === 'shopify'
                        ? 'bg-white dark:bg-zinc-900 text-[#2563eb] shadow-sm ring-1 ring-blue-200/80 dark:ring-blue-800/60'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {t('rgpdTabShopify')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={ecommerceConsentHelpTab === 'stripe'}
                    onClick={() => setEcommerceConsentHelpTab('stripe')}
                    className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-lg text-xs font-semibold text-center transition-colors ${
                      ecommerceConsentHelpTab === 'stripe'
                        ? 'bg-white dark:bg-zinc-900 text-[#2563eb] shadow-sm ring-1 ring-blue-200/80 dark:ring-blue-800/60'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {t('rgpdTabStripe')}
                  </button>
                </div>

                {ecommerceConsentHelpTab === 'shopify' ? (
                  <div
                    role="tabpanel"
                    className="rounded-lg border border-slate-200/80 dark:border-zinc-700/80 bg-slate-50/50 dark:bg-zinc-900/40 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                      <span aria-hidden>📍</span> {t('rgpdShopifyIntro')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('rgpdDashboardInstruction')}</p>
                    <ol className="list-decimal pl-4 space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {RGPD_SHOPIFY_LI_KEYS.map((key) => (
                        <li key={key}>
                          {t.rich(key, {
                            bold: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div
                    role="tabpanel"
                    className="rounded-lg border border-slate-200/80 dark:border-zinc-700/80 bg-slate-50/50 dark:bg-zinc-900/40 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                      <span aria-hidden>📍</span> {t('rgpdStripeIntro')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('rgpdDashboardInstruction')}</p>
                    <ol className="list-decimal pl-4 space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {RGPD_STRIPE_LI_KEYS.map((key) => (
                        <li key={key}>
                          {t.rich(key, {
                            bold: (chunks) => <strong>{chunks}</strong>,
                          })}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-white/90 dark:bg-zinc-900/80 p-4 mb-5">
                <div className="flex items-start gap-2.5 mb-2">
                  <FileText className="w-4 h-4 text-[#2563eb] dark:text-blue-400 shrink-0 mt-0.5" aria-hidden />
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 leading-snug">
                    {t('rgpdClauseHeading')}
                  </p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 pl-0 sm:pl-7 leading-relaxed">
                  {t.rich('rgpdClauseInstruction', {
                    bold: (chunks) => <strong className="text-slate-700 dark:text-slate-300">{chunks}</strong>,
                  })}
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-3 pl-0 sm:pl-7">
                  {t('rgpdClauseBody')}
                </p>
                <div className="sm:pl-7">
                  <CopyButton
                    value={t('rgpdClauseBody')}
                    copyLabel={t('rgpdCopyClauseLabel')}
                    copiedLabel={t('copiedVerb')}
                    title={t('copyTitle', { item: t('copyItemClause') })}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mt-5 pt-4 border-t border-blue-200/60 dark:border-blue-800/50 leading-relaxed">
                <strong className="text-slate-700 dark:text-slate-300">{t('rgpdNoteTitle')}</strong>{' '}
                {t('rgpdNoteBody')}
              </p>
            </section>
          )}

          {/* ── Section 2 : Webhook — e-com = après livraison ; physique = caisse (webhook) ou inscription client via QR page publique Wallet ── */}
          <section className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm p-6 mb-6">
                <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base mb-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2563eb]/10 text-[#2563eb] text-xs font-bold flex items-center justify-center">2</span>
                  {t('section2Title')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
                  {activityProfile.key === 'ecommerce'
                    ? t('section2IntroEcommerce')
                    : t('section2IntroPhysical')}
                </p>

                <div className="space-y-5">

              {/* ── Lien de Connexion Webhook ────────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                  {t('webhookLinkLabel')}
                </label>

                {profile?.api_key ? (
                  <>
                    {/* URL complète à copier */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 mb-1.5">
                      <code className="flex-1 text-sm text-[#2563eb] dark:text-blue-400 font-mono truncate select-all">
                        {t('webhookUrlDisplay', { siteUrl: SITE_URL, apiKey: profile.api_key })}
                      </code>
                      <CopyButton
                        value={t('webhookUrlDisplay', { siteUrl: SITE_URL, apiKey: profile.api_key })}
                        copyLabel={t('copyVerb')}
                        copiedLabel={t('copiedVerb')}
                        title={t('copyTitle', { item: t('copyItemLink') })}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateApiKey}
                        disabled={generatingApiKey}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        title={t('rotateKeyTitle')}
                      >
                        {generatingApiKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t('webhookRotateWarning')}</p>
                  </>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                      {t('noApiKey')}
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateApiKey}
                      disabled={generatingApiKey || !isZenith}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                    >
                      {generatingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      {t('generateLink')}
                    </button>
                  </div>
                )}
              </div>

              {/* ── Affiche caisse (physique) / rappel checkout (e-commerce) ── */}
              {activityProfile.key === 'ecommerce' ? (
                <div className="rounded-xl border border-slate-200/90 dark:border-zinc-700/80 bg-slate-50/80 dark:bg-zinc-900/40 px-4 py-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t('ecommerceCheckoutNote')}
                  </p>
                </div>
              ) : (
                renderAfficheRgpdSection()
              )}

              {/* ── Format du payload ───────────────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                  {t('payloadFormatLabel')}
                </label>
                {activityProfile.key === 'ecommerce' ? (
                  <>
                    <div className="rounded-xl overflow-hidden border border-slate-700 dark:border-zinc-700 bg-[#0c0c0e] dark:bg-[#050506] shadow-inner">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700/80 bg-slate-900/90 dark:bg-zinc-900/90">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate min-w-0">
                          {t('payloadEcommerceTitle')}
                        </span>
                        <div className="shrink-0">
                          <CopyButton
                            value={ecommerceWebhookExample}
                            copyLabel={t('copyJsonExample')}
                            copiedLabel={t('copiedJsonExample')}
                            title={t('copyTitle', { item: t('copyItemJsonExample') })}
                          />
                        </div>
                      </div>
                      <pre className="p-4 text-[12px] sm:text-[13px] leading-relaxed font-mono text-emerald-300 dark:text-emerald-300/95 selection:bg-emerald-500/25 selection:text-emerald-100 overflow-x-auto min-w-0 whitespace-pre border-t border-slate-800/80">
{ecommerceWebhookExample}
                      </pre>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/50 p-3.5">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                          <span aria-hidden>👤</span> {t('ecomCardIdentity')}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {t('ecomCardIdentityBody')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/50 p-3.5">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                          <span aria-hidden>✅</span> {t('ecomCardCompliance')}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {t('ecomCardComplianceBody')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/50 p-3.5">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                          <span aria-hidden>📦</span> {t('ecomCardLogistics')}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {t('ecomCardLogisticsBody')}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <pre className="p-4 rounded-xl bg-slate-900 dark:bg-zinc-950 text-emerald-400 text-xs sm:text-[13px] font-mono overflow-x-auto leading-relaxed border border-slate-700 selection:bg-emerald-500/20">
{physicalWebhookExample}
                    </pre>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {t('webhookPhysicalPayloadExplainer')}
                    </p>
                  </>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  {t('payloadNoAuthNote')}
                </p>
              </div>

              {/* ── Accès legacy (token header) ─────────────────────────────── */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 select-none list-none flex items-center gap-1.5">
                  <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                  {t('legacySummary')}
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                      {t('legacyTokenLabel')}
                    </label>
                    {profile?.webhook_token ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700">
                        <code className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-300 truncate">
                          {showToken ? profile.webhook_token : '•'.repeat(Math.min(profile.webhook_token.length, 40))}
                        </code>
                        <button
                          type="button"
                          onClick={() => setShowToken((v) => !v)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <CopyButton
                          value={profile.webhook_token}
                          copyLabel={t('copyVerb')}
                          copiedLabel={t('copiedVerb')}
                          title={t('copyTitle', { item: t('copyItemToken') })}
                        />
                        <button
                          type="button"
                          onClick={handleGenerateToken}
                          disabled={generatingToken}
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                          {generatingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateToken}
                        disabled={generatingToken || !isZenith}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      >
                        {generatingToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {t('generateLegacyToken')}
                      </button>
                    )}
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 dark:bg-zinc-950 text-slate-400 text-xs font-mono overflow-x-auto leading-relaxed border border-slate-700">
{t('legacyZenithEndpoint', { siteUrl: SITE_URL, tokenHint: t('legacyZenithTokenHint') })}
                  </pre>
                </div>
              </details>

            </div>
          </section>

          {/* ── Section 3 : Santé du Workflow + Statistiques ──────────────── */}
          <section>

            {/* ── Bannière Santé du Workflow ────────────────────────────────── */}
            <div className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm p-5 mb-4">
              <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2563eb]/10 text-[#2563eb] text-xs font-bold flex items-center justify-center">3</span>
                <Activity className="w-4 h-4 text-[#2563eb]" />
                {t('section3Title')}
              </h2>
              {activityProfile.key !== 'ecommerce' ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 -mt-2 leading-relaxed max-w-3xl">
                  {t('section3IntroNonEcommerce')}
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200/60 dark:border-emerald-800/40">
                  <div className="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-200 dark:ring-emerald-800" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-0.5">{t('webhookActive')}</p>
                    {profile?.api_key ? (
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate flex-1">
                          {t('webhookUrlDisplay', { siteUrl: '', apiKey: profile.api_key })}
                        </code>
                        <CopyButton
                          value={t('webhookUrlDisplay', { siteUrl: SITE_URL, apiKey: profile.api_key })}
                          copyLabel={t('copyVerb')}
                          copiedLabel={t('copiedVerb')}
                          title={t('copyTitle', { item: t('copyItemLink') })}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 items-start">
                        <span className="text-xs text-amber-600 dark:text-amber-400">{t('noKeyGenerated')}</span>
                        <button
                          type="button"
                          onClick={() => void handleGenerateApiKey()}
                          disabled={generatingApiKey || !isZenith}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                        >
                          {generatingApiKey ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          {t('generateLink')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* File d'attente */}
                <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                  (stats?.pending ?? 0) === 0
                    ? 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-700'
                    : (stats?.pending ?? 0) < 10
                    ? 'bg-blue-50 dark:bg-blue-900/15 border-blue-200/60 dark:border-blue-800/40'
                    : 'bg-amber-50 dark:bg-amber-900/15 border-amber-200/60 dark:border-amber-800/40'
                }`}>
                  <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${
                    (stats?.pending ?? 0) === 0 ? 'text-slate-400' :
                    (stats?.pending ?? 0) < 10  ? 'text-blue-500' : 'text-amber-500'
                  }`} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('queueTitle')}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                      {statsLoading ? '…' : (stats?.pending ?? 0)}
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">{t('pendingSuffix')}</span>
                    </p>
                  </div>
                </div>

                {/* Avis générés avec succès */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/40">
                  <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{t('reviewsPublished')}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                      {statsLoading ? '…' : (stats?.published ?? 0)}
                      {(stats?.total ?? 0) > 0 && !statsLoading && (
                        <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-1">
                          ({Math.round(((stats?.published ?? 0) / stats!.total) * 100)} %)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t('polishedPublishedSub')}</p>
                  </div>
                </div>

              </div>
            </div>

            {/* ── En-tête funnel + filtre temporel ─────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                {t('dashboardTitle')}
              </h2>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all"
              >
                {timeRangeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* ── Cartes funnel ────────────────────────────────────────────── */}
            {statsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 h-28 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Carte 1 — Flux Total */}
                <StatCard
                  label={t('statTotalFlow')}
                  value={stats?.total ?? 0}
                  sub={t('statTotalFlowSub')}
                  icon={<Users className="w-5 h-5 text-blue-600" />}
                  color="bg-blue-50 dark:bg-blue-900/20"
                />

                {/* Carte 2 — Réponses OUI */}
                <StatCard
                  label={t('statYes')}
                  value={stats?.engaged ?? 0}
                  sub={
                    (stats?.total ?? 0) > 0
                      ? t('statYesSubEngagement', {
                        pct: Math.round(((stats?.engaged ?? 0) / stats!.total) * 100),
                      })
                      : t('statYesSubWaiting')
                  }
                  icon={<MessageSquare className="w-5 h-5 text-emerald-600" />}
                  color="bg-emerald-50 dark:bg-emerald-900/20"
                />

                {/* Carte 3 — Désinscriptions NON */}
                <StatCard
                  label={t('statNo')}
                  value={stats?.cancelled ?? 0}
                  sub={
                    (stats?.total ?? 0) > 0
                      ? t('statNoSubShare', {
                        pct: Math.round(((stats?.cancelled ?? 0) / stats!.total) * 100),
                      })
                      : t('statNoSubNone')
                  }
                  icon={<UserX className="w-5 h-5 text-rose-500" />}
                  color="bg-rose-50 dark:bg-rose-900/20"
                />

                {/* Carte 4 — Avis Générés */}
                <div className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm p-5 flex items-start gap-4">
                  <div className="rounded-xl p-2.5 shrink-0 bg-amber-50 dark:bg-amber-900/20">
                    <Star className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{t('statGeneratedTitle')}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-0.5 tabular-nums">
                      {stats?.published ?? 0}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {t('statGeneratedSub')}
                    </p>
                    {(stats?.total ?? 0) > 0 && (
                      <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        {t('statTransform', {
                          pct: Math.round(((stats?.published ?? 0) / stats!.total) * 100),
                        })}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Journal traçabilité : entrées file + consentements WhatsApp */}
            <div className="mt-6 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-slate-50/80 dark:bg-zinc-950/50 overflow-hidden shadow-sm">
              <div className="flex items-start gap-2 px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/30">
                <ClipboardList className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t('auditTitle')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {t('auditIntro')}
                  </p>
                </div>
              </div>
              {auditLoading ? (
                <div className="p-6 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" /> {t('auditLoading')}
                </div>
              ) : (
                <div className="max-h-[22rem] overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-zinc-900/95 border-b border-slate-200 dark:border-zinc-800">
                      <tr className="text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <th className="px-3 py-2 font-medium">{t('auditColReceived')}</th>
                        <th className="px-3 py-2 font-medium">{t('auditColOrigin')}</th>
                        <th className="px-3 py-2 font-medium">{t('auditColClient')}</th>
                        <th className="px-3 py-2 font-medium">{t('auditColScheduled')}</th>
                        <th className="px-3 py-2 font-medium">{t('auditColStatus')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {auditRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                            {t('auditEmpty')}
                          </td>
                        </tr>
                      ) : (
                        auditRows.map((row) => {
                          const meta = row.metadata;
                          const received =
                            (typeof meta?.received_at === 'string' && meta.received_at) ||
                            row.created_at;
                          const lastPurchase =
                            typeof meta?.last_purchase === 'string' ? meta.last_purchase.trim() : '';
                          const src = row.source_info?.trim() || '';
                          return (
                            <tr key={row.id} className="text-slate-700 dark:text-slate-300 bg-white/40 dark:bg-zinc-950/20">
                              <td className="px-3 py-2 whitespace-nowrap align-top font-mono text-[11px]">
                                {new Date(received).toLocaleString(dateLocaleTag)}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {ingressLabel(meta)}
                                </span>
                                {lastPurchase !== '' && (
                                  <div
                                    className="text-[10px] text-slate-500 mt-0.5 max-w-[11rem] truncate"
                                    title={lastPurchase}
                                  >
                                    {t('auditPurchasePrefix')} {lastPurchase}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="font-medium">{row.first_name || '—'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{maskPhoneForAudit(row.phone)}</div>
                                {src !== '' && (
                                  <div className="text-[10px] text-slate-500 mt-0.5 max-w-[10rem] truncate" title={src}>
                                    {src}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top whitespace-nowrap text-[11px]">
                                <div>
                                  {t('scheduledLine', {
                                    datetime: new Date(row.scheduled_at).toLocaleString(dateLocaleTag),
                                  })}
                                </div>
                                {row.sent_at && (
                                  <div className="text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    {t('sentLine', {
                                      datetime: new Date(row.sent_at).toLocaleString(dateLocaleTag),
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-zinc-800 text-slate-800 dark:text-slate-200">
                                  {queueStatusLabelFn(row.status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {!auditLoading && consentAuditRows.length > 0 && (
                <div className="border-t border-slate-200 dark:border-zinc-800 px-3 py-3 bg-slate-50/90 dark:bg-zinc-950/40">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    {t('auditConsentHeading')}
                  </p>
                  <ul className="space-y-2 max-h-32 overflow-auto text-[11px]">
                    {consentAuditRows.map((c) => (
                      <li key={c.id} className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 dark:text-slate-400">
                        <span className="font-mono whitespace-nowrap">
                          {new Date(c.created_at).toLocaleString(dateLocaleTag)}
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {consentTypeLabelFn(c.consent_type)}
                        </span>
                        <span className="opacity-80">{c.channel}</span>
                        {c.review_queue_id && (
                          <span className="font-mono text-[10px] opacity-60" title={c.review_queue_id}>
                            {t('auditQueueRef', { id: c.review_queue_id.slice(0, 8) })}
                          </span>
                        )}
                        {c.message_preview && (
                          <span className="block w-full truncate opacity-70" title={c.message_preview}>
                            « {c.message_preview} »
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
              {t('auditRetention')}
            </p>
          </section>

        </div>
        {/* /blurred sections */}
      </div>
      {/* /overlay wrapper */}

      {/* ── Rappel CGV — switch vers e-commerce OU confirmation avant sauvegarde ──
          Tunnel strict : pas d’Annuler, pas de clic overlay, pas d’Échap — uniquement le bouton d’engagement. */}
      {showEcommerceCgvModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ecommerce-cgv-modal-title"
          aria-describedby="ecommerce-cgv-modal-warning"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-xl p-6 space-y-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <p
                id="ecommerce-cgv-modal-title"
                className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
              >
                <strong className="text-slate-900 dark:text-slate-100">{t('ecommerceModalLead')}</strong>{' '}
                {t('ecommerceModalTitle')}
              </p>
              <p
                id="ecommerce-cgv-modal-warning"
                className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2.5"
              >
                {t('ecommerceModalWarning')}
              </p>
            </div>
            <div className="flex flex-col items-stretch pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowEcommerceCgvModal(false);
                  doActualSave();
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-[#2563eb] text-white font-semibold text-sm sm:text-base text-center shadow-md shadow-[#2563eb]/25 hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 transition-colors"
              >
                {t('ecommerceModalCta')}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 dark:text-slate-500 max-w-3xl mx-auto leading-relaxed px-2">
        {t('pageFooterLegal')}
      </p>
    </div>
  );
}
/** Route App Router : pas de props custom sur l’export default (exigence Next.js). */
export default function CollecteAvisRoutePage() {
  return <CollecteAvisPage pageVariant="collecte-avis" />;
}

