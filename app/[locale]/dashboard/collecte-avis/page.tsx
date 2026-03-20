'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { toPlanSlug } from '@/lib/feature-gate';
import { toast } from 'sonner';
import {
  Copy, Eye, EyeOff, CheckCircle2, Lock, Loader2,
  MessageCircle, Zap, RefreshCw, FileDown, Shield,
  Users, MessageSquare, UserX, Star, Clock, Activity,
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

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d',  label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '6m',  label: '6 derniers mois' },
  { value: 'all', label: 'Tout le temps' },
];

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

type ActivityProfile = {
  key: string;
  label: string;
  targetMinutes: number | null;  // null = personnalisé
  example: string;
};

const ACTIVITY_PROFILES: ActivityProfile[] = [
  { key: 'restaurant',   label: 'Restauration',                        targetMinutes: 45,   example: 'Envoi ~45 min après le repas' },
  { key: 'bakery',       label: 'Boulangerie / Pâtisserie',            targetMinutes: 120,  example: 'Envoi ~2h après l\'achat' },
  { key: 'beauty',       label: 'Beauté & Soins',                      targetMinutes: 180,  example: 'Envoi ~3h après le soin' },
  { key: 'garage',       label: 'Garage Automobile',                   targetMinutes: 1440, example: 'Envoi ~24h après la restitution du véhicule' },
  { key: 'hotel',        label: 'Hôtellerie',                          targetMinutes: 120,  example: 'Envoi ~2h après le check-out' },
  { key: 'artisan',      label: 'Artisan / Prestataire',               targetMinutes: 240,  example: 'Envoi ~4h après la fin du chantier' },
  { key: 'fast_service', label: 'Services Rapides / Vente à emporter', targetMinutes: 20,   example: 'Envoi ~20 min après l\'achat' },
  { key: 'custom',       label: 'Personnalisé (délai libre)',           targetMinutes: null, example: 'Vous définissez le délai exact en minutes' },
];

/** Retrouve le profil correspondant à un délai sauvegardé (ou 'custom' si aucun preset). */
function profileFromMinutes(minutes: number | null): ActivityProfile {
  if (minutes === null) return ACTIVITY_PROFILES[ACTIVITY_PROFILES.length - 1];
  return (
    ACTIVITY_PROFILES.find((p) => p.targetMinutes === minutes) ??
    ACTIVITY_PROFILES[ACTIVITY_PROFILES.length - 1]
  );
}

/** Formate un délai en minutes en texte lisible et contextuel pour la note UX. */
function formatDelayLabel(minutes: number): string {
  if (minutes >= 1440) return 'le lendemain';
  if (minutes < 60) return `environ ${minutes} min`;
  if (minutes === 60) return 'environ 1h';
  return `environ ${Math.round(minutes / 60)}h`;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reputexa.fr';

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

function CopyButton({ value, label }: { value: string; label?: string }) {
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
      title={`Copier ${label ?? ''}`}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CollecteAvisPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  const [activityProfile, setActivityProfile] = useState<ActivityProfile>(ACTIVITY_PROFILES[0]);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [showToken, setShowToken] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [generatingPoster, setGeneratingPoster] = useState(false);

  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

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
      .select('id, subscription_plan, selected_plan, establishment_name, google_review_url, webhook_token, api_key, webhook_send_delay_minutes, business_category')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
      // Priorité : business_category persiste la sélection du profil activité
      const savedCategory = (data.business_category as string | null) ?? null;
      const savedMinutes  = (data.webhook_send_delay_minutes as number | null) ?? 45;
      const matchedByCategory = savedCategory
        ? ACTIVITY_PROFILES.find((p) => p.key === savedCategory)
        : null;
      const matched = matchedByCategory ?? profileFromMinutes(savedMinutes);
      setActivityProfile(matched);
      if (matched.key === 'custom') setCustomMinutes(savedMinutes);
    }
    setLoading(false);
  }, []);

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

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => { loadStats();   }, [loadStats]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const effectiveMinutes =
    activityProfile.key === 'custom'
      ? customMinutes
      : (activityProfile.targetMinutes ?? 30);

  const handleSaveConfig = async () => {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        webhook_send_delay_minutes: effectiveMinutes,
        business_category: activityProfile.key,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Erreur lors de la sauvegarde.');
    } else {
      toast.success('Paramètres enregistrés.');
      setProfile((p) => p ? { ...p, webhook_send_delay_minutes: effectiveMinutes } : p);
    }
    setSaving(false);
  };

  const handleGenerateToken = async () => {
    if (!profile) return;
    setGeneratingToken(true);
    try {
      const res = await fetch('/api/profile/generate-webhook-token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setProfile((p) => p ? { ...p, webhook_token: data.token } : p);
      toast.success('Token legacy régénéré. Mettez à jour votre POS si vous utilisez encore cette méthode.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération.');
    }
    setGeneratingToken(false);
  };

  const handleGenerateApiKey = async () => {
    if (!profile) return;
    setGeneratingApiKey(true);
    try {
      const res = await fetch('/api/profile/generate-api-key', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setProfile((p) => p ? { ...p, api_key: data.api_key } : p);
      toast.success('Nouvelle clé générée. Mettez à jour votre configuration POS immédiatement.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération.');
    }
    setGeneratingApiKey(false);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-[#2563eb]" />
            Collecte d&apos;Avis
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Automatisez la sollicitation d&apos;avis WhatsApp après chaque vente — Plan Zenith.
          </p>
        </div>
        {isZenith && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 uppercase tracking-wide">
            <Zap className="w-3 h-3" /> Zenith actif
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
              Fonctionnalité réservée au Plan Zenith
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-sm text-sm leading-relaxed">
              La collecte automatique d&apos;avis via WhatsApp (connexion POS, fenêtre de courtoisie, RGPD)
              est exclusivement disponible avec le Plan Zenith.
            </p>
            <Link
              href="/upgrade"
              className="inline-flex items-center gap-2 bg-[#2563eb] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1d4ed8] transition-colors shadow-lg shadow-[#2563eb]/25"
            >
              <Zap className="w-4 h-4" />
              Activer la collecte automatique Zenith
            </Link>
          </div>
        )}

        {/* ── Sections (blurred content for non-Zenith) ─────────────────── */}
        <div className={!isZenith ? 'pointer-events-none select-none' : undefined}>

          {/* ── Section 1 : Configuration ────────────────────────────────── */}
          <section className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm p-6 mb-6">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#2563eb]/10 text-[#2563eb] text-xs font-bold flex items-center justify-center">1</span>
              Configuration du message
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
              Définissez le délai idéal avant qu&apos;un message soit envoyé à vos clients après leur visite.
            </p>

            <div className="space-y-4">
              {/* Activity profile */}
              <div>
                <label htmlFor="activity-profile" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Profil d&apos;activité
                </label>
                <select
                  id="activity-profile"
                  value={activityProfile.key}
                  onChange={(e) => {
                    const found = ACTIVITY_PROFILES.find((p) => p.key === e.target.value);
                    if (found) setActivityProfile(found);
                  }}
                  className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all text-sm"
                >
                  {ACTIVITY_PROFILES.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>

                {/* Champ libre si Personnalisé */}
                {activityProfile.key === 'custom' && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <input
                      type="number"
                      min={5}
                      max={2880}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(Math.max(5, Number(e.target.value)))}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all text-sm"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">minutes</span>
                  </div>
                )}

                {/* Note UX dynamique */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-1.5">
                  <span className="text-blue-500 shrink-0 mt-px">ℹ️</span>
                  Le système calcule automatiquement un moment opportun
                  {' '}(<strong>{formatDelayLabel(effectiveMinutes)}</strong>)
                  {' '}avec une légère variation aléatoire pour paraître naturel.
                </p>
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
                Enregistrer les paramètres
              </button>
            </div>
          </section>

          {/* ── Section 2 : Webhook ──────────────────────────────────────── */}
          <section className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm p-6 mb-6">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#2563eb]/10 text-[#2563eb] text-xs font-bold flex items-center justify-center">2</span>
              Connexion à votre caisse (Webhook)
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
              Donnez ces accès à votre fournisseur de logiciel de caisse pour automatiser l&apos;envoi.
            </p>

            <div className="space-y-5">

              {/* ── Lien de Connexion Webhook ────────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                  Lien de Connexion Webhook
                </label>

                {profile?.api_key ? (
                  <>
                    {/* URL complète à copier */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 mb-1.5">
                      <code className="flex-1 text-sm text-[#2563eb] dark:text-blue-400 font-mono truncate select-all">
                        {SITE_URL}/api/webhooks/{profile.api_key}
                      </code>
                      <CopyButton value={`${SITE_URL}/api/webhooks/${profile.api_key}`} label="le lien" />
                      <button
                        type="button"
                        onClick={handleGenerateApiKey}
                        disabled={generatingApiKey}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        title="Générer une nouvelle clé (révoque l&apos;ancienne URL immédiatement)"
                      >
                        {generatingApiKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      ⚠️ Tournez la clé révoque l&apos;ancienne URL — mettez à jour votre POS / Zapier immédiatement.
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm text-amber-700 dark:text-amber-300 flex-1">
                      Aucune clé API générée pour ce compte.
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateApiKey}
                      disabled={generatingApiKey || !isZenith}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                    >
                      {generatingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      Générer mon lien
                    </button>
                  </div>
                )}
              </div>

              {/* ── Affiche de conformité PDF ────────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                  Affiche de conformité RGPD
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setGeneratingPoster(true);
                      try {
                        const name = encodeURIComponent(profile?.establishment_name ?? 'Votre établissement');
                        const res = await fetch(`/api/compliance-poster?establishmentName=${name}`);
                        if (!res.ok) throw new Error('Erreur');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `affiche-conformite-${(profile?.establishment_name ?? 'etablissement').replace(/\s+/g, '-').slice(0, 30)}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Affiche téléchargée.');
                      } catch (err) {
                        toast.error('Erreur lors de la génération.');
                      } finally {
                        setGeneratingPoster(false);
                      }
                    }}
                    disabled={generatingPoster || !isZenith}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    Générer mon affiche de conformité <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">(Facultatif)</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
                  Conseil : Placez cette affiche à la caisse pour rassurer vos clients.
                </p>
              </div>

              {/* ── Format du payload ───────────────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                  Format du payload attendu (JSON)
                </label>
                <pre className="p-3 rounded-xl bg-slate-900 dark:bg-zinc-950 text-emerald-400 text-xs font-mono overflow-x-auto leading-relaxed border border-slate-700">
{`POST ${SITE_URL}/api/webhooks/<votre-clé>
Content-Type: application/json

{
  "first_name":    "Sophie",
  "phone":         "+33612345678",
  "last_purchase": "Soin Kératine",    // optionnel — personnalise la question
  "source_info":   "Zelty / Caisse 1"  // optionnel
}`}
                </pre>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  Aucun header d&apos;authentification requis — la clé est intégrée dans l&apos;URL.
                </p>
              </div>

              {/* ── Accès legacy (token header) ─────────────────────────────── */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 select-none list-none flex items-center gap-1.5">
                  <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                  Afficher la méthode legacy (header x-reputexa-token)
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                      Token legacy (x-reputexa-token)
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
                        <CopyButton value={profile.webhook_token} label="le token" />
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
                        Générer le token legacy
                      </button>
                    )}
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 dark:bg-zinc-950 text-slate-400 text-xs font-mono overflow-x-auto leading-relaxed border border-slate-700">
{`POST https://reputexa.fr/api/webhooks/zenith
x-reputexa-token: <token-legacy>
Content-Type: application/json`}
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
                Santé du Workflow
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                {/* Webhook actif */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200/60 dark:border-emerald-800/40">
                  <div className="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-200 dark:ring-emerald-800" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Webhook actif</p>
                    {profile?.api_key ? (
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate flex-1">
                          {`/api/webhooks/${profile.api_key}`}
                        </code>
                        <CopyButton value={`${SITE_URL}/api/webhooks/${profile.api_key}`} label="le lien" />
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">Aucune clé générée</span>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">File d&apos;attente</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                      {statsLoading ? '…' : (stats?.pending ?? 0)}
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">en attente</span>
                    </p>
                  </div>
                </div>

                {/* Avis générés avec succès */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/40">
                  <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Avis publiés</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                      {statsLoading ? '…' : (stats?.published ?? 0)}
                      {(stats?.total ?? 0) > 0 && !statsLoading && (
                        <span className="text-xs font-normal text-amber-600 dark:text-amber-400 ml-1">
                          ({Math.round(((stats?.published ?? 0) / stats!.total) * 100)} %)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">textes sublimés et publiés</p>
                  </div>
                </div>

              </div>
            </div>

            {/* ── En-tête funnel + filtre temporel ─────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                Tableau de Bord Zenith
              </h2>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all"
              >
                {TIME_RANGE_OPTIONS.map((opt) => (
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
                  label="Flux Total"
                  value={stats?.total ?? 0}
                  sub="Clients importés via Webhook"
                  icon={<Users className="w-5 h-5 text-blue-600" />}
                  color="bg-blue-50 dark:bg-blue-900/20"
                />

                {/* Carte 2 — Réponses OUI */}
                <StatCard
                  label="Réponses (OUI)"
                  value={stats?.engaged ?? 0}
                  sub={
                    (stats?.total ?? 0) > 0
                      ? `${Math.round(((stats?.engaged ?? 0) / stats!.total) * 100)} % d'engagement`
                      : 'En attente de réponses'
                  }
                  icon={<MessageSquare className="w-5 h-5 text-emerald-600" />}
                  color="bg-emerald-50 dark:bg-emerald-900/20"
                />

                {/* Carte 3 — Désinscriptions NON */}
                <StatCard
                  label="Désinscriptions (NON)"
                  value={stats?.cancelled ?? 0}
                  sub={
                    (stats?.total ?? 0) > 0
                      ? `${Math.round(((stats?.cancelled ?? 0) / stats!.total) * 100)} % du flux total`
                      : 'Aucune désinscription'
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Avis Générés</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-0.5 tabular-nums">
                      {stats?.published ?? 0}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Texte sublimé &amp; publié par le client
                    </p>
                    {(stats?.total ?? 0) > 0 && (
                      <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        {Math.round(((stats?.published ?? 0) / stats!.total) * 100)} % de transformation
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )}

            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
              Les données personnelles sont anonymisées après 90 jours pour garantir votre conformité RGPD tout en conservant vos statistiques historiques.
            </p>
          </section>

        </div>
        {/* /blurred sections */}
      </div>
      {/* /overlay wrapper */}

    </div>
  );
}
