'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasFeature, FEATURES, toPlanSlug, type PlanSlug } from '@/lib/feature-gate';
import { useActiveLocation } from '@/lib/active-location-context';
import { DashboardInlineLoading } from '@/components/dashboard/dashboard-inline-loading';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import { StarRating } from '@/components/dashboard/star-rating';
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Send,
  FileText,
  ExternalLink,
  Lock,
  Zap,
  EyeOff,
  Loader2,
  Pencil,
  Clock3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import type { ShieldAnalysisResult } from '@/app/api/shield/analyze/route';

type AlertReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText?: string | null;
  createdAt: string;
  isToxic: boolean;
  toxicityReason?: string | null;
  toxicityComplaintText?: string | null;
  toxicityLegalArgumentation?: string | null;
  resolved: boolean;
  // enriched client-side after AI analysis
  analysisResult?: ShieldAnalysisResult;
};

type NegativeAlertReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  aiResponse: string | null;
  responseText: string | null;
  createdAt: string;
};

const ALERT_PROGRESS_ICONS = [AlertTriangle, FileText, Send, CheckCircle2] as const;

/** Styles des cartes stats (hors JSX pour i18next/no-literal-string). */
const ALERT_STAT_CARD_STYLES = [
  { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/[0.06]', border: 'border-red-200 dark:border-red-900/30' },
  { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/[0.06]', border: 'border-amber-200 dark:border-amber-900/30' },
  { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/[0.06]', border: 'border-emerald-200 dark:border-emerald-900/30' },
] as const;

const TOXIC_CARD_BORDER_ACCENT = {
  critical: 'border-l-red-600',
  warning: 'border-l-orange-500',
  caution: 'border-l-amber-500',
} as const;

function toxicCardBorderAccent(rating: number): string {
  if (rating <= 1) return TOXIC_CARD_BORDER_ACCENT.critical;
  if (rating === 2) return TOXIC_CARD_BORDER_ACCENT.warning;
  return TOXIC_CARD_BORDER_ACCENT.caution;
}

const REMOVAL_PROGRESS_DONE_MARK = '✓';

function buildReportInfo(
  source: string,
  locale: string,
  tr: (key: string) => string,
): { url: string; label: string } {
  const hlMap: Record<string, string> = {
    fr: 'fr',
    en: 'en',
    es: 'es',
    de: 'de',
    it: 'it',
    pt: 'pt-BR',
    ja: 'ja',
    zh: 'zh-Hans',
  };
  const hl = hlMap[locale] ?? 'en';
  const n = (source ?? '').toLowerCase();
  if (n.includes('google')) {
    return {
      url: `https://support.google.com/business/answer/4596773?hl=${hl}`,
      label: tr('platformGoogle'),
    };
  }
  if (n.includes('facebook')) {
    return { url: 'https://www.facebook.com/business/help', label: tr('platformFacebook') };
  }
  if (n.includes('trustpilot')) {
    const tpSlug = locale === 'fr' ? 'fr' : 'en-us';
    return {
      url: `https://support.trustpilot.com/hc/${tpSlug}/articles/201839903`,
      label: tr('platformTrustpilot'),
    };
  }
  return {
    url: `https://support.google.com/business/answer/4596773?hl=${hl}`,
    label: tr('platformGeneric'),
  };
}

// ─────────────────────────────────────────────
// WhatsApp notification preview (simulation)
// ─────────────────────────────────────────────
function WhatsAppPreview({ review }: { review: AlertReview }) {
  const t = useTranslations('Dashboard.alertsPage');
  const locale = useLocale();
  const now = new Date();
  const timeStr = now.toLocaleTimeString(siteLocaleToIntlDateTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.06] shadow-lg">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#075E54]">
        <div className="w-8 h-8 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">{t('whatsappBrand')}</p>
          <p className="text-emerald-300 text-[11px]">{t('whatsappSecurityAlert')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-300">{t('whatsappOnline')}</span>
        </div>
      </div>
      <div className="bg-[#ece5dd] dark:bg-[#1a1f36] p-4 flex justify-end">
        <div className="max-w-[90%] bg-white dark:bg-[#252d4a] rounded-2xl rounded-tr-none shadow-sm p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm">🚨</span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
              {t('whatsappToxicDetected')}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-medium">{t('whatsappAuthorLabel')}</span> {review.reviewerName}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-2">
            &ldquo;{review.comment.slice(0, 90)}{review.comment.length > 90 ? '…' : ''}&rdquo;
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">{t('whatsappPlatformLabel')}</span> {review.source}
          </p>
          <div className="pt-1.5 border-t border-slate-100 dark:border-white/10">
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {t('whatsappTapToManage')}
            </p>
          </div>
          <p className="text-[10px] text-slate-400 text-right mt-0.5">
            {timeStr}
            {t('whatsappReadReceiptMarks')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AI Analysis indicator
// ─────────────────────────────────────────────
function AnalyzingIndicator() {
  const t = useTranslations('Dashboard.alertsPage');
  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 px-4 py-3">
      <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{t('analyzingTitle')}</p>
        <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">{t('analyzingSubtitle')}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Flag badges
// ─────────────────────────────────────────────
function FlagBadges({ result }: { result: ShieldAnalysisResult }) {
  const t = useTranslations('Dashboard.alertsPage');
  const badges = [
    { key: 'hatred', label: t('flagHatred'), active: result.flags.hatred, color: 'bg-red-500' },
    { key: 'fake', label: t('flagFake'), active: result.flags.fake, color: 'bg-orange-500' },
    { key: 'threat', label: t('flagThreat'), active: result.flags.threat, color: 'bg-purple-600' },
  ] as const;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {badges.map((b) => (
        <span
          key={b.key}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            b.active
              ? `${b.color} text-white`
              : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 line-through opacity-50'
          }`}
        >
          {b.active && <span className="w-1 h-1 rounded-full bg-white/70" />}
          {b.label}
        </span>
      ))}
      <span className="ml-auto text-[10px] text-slate-500 dark:text-slate-400 font-medium">
        <span className={result.confidence >= 75 ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}>
          {t('confidenceLabel', { percent: result.confidence })}
        </span>
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Shield Modal — Gérer l'alerte
// ─────────────────────────────────────────────
function ShieldModal({
  review,
  onClose,
  onSend,
  isSending,
  step,
}: {
  review: AlertReview;
  onClose: () => void;
  onSend: (text: string) => void;
  isSending: boolean;
  step: number;
}) {
  const t = useTranslations('Dashboard.alertsPage');
  const locale = useLocale();
  const { label: platformLabel } = buildReportInfo(review.source, locale, t);
  const progressLabels = useMemo(
    () => [
      t('progressDetection'),
      t('progressValidation'),
      t('progressSendGoogle'),
      t('progressVerdict'),
    ],
    [t],
  );
  const defaultComplaint =
    review.analysisResult?.complaintText ||
    review.toxicityLegalArgumentation ||
    review.toxicityComplaintText ||
    t('legalComplaintTemplate', { reviewerName: review.reviewerName });

  const [editedText, setEditedText] = useState(defaultComplaint);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-5xl bg-white dark:bg-[#050d25] border border-slate-200 dark:border-[#0e1e40] rounded-2xl shadow-2xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#0e1e40]/80 bg-slate-50/80 dark:bg-[#030c1e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">{t('modalTitle')}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('modalSubtitle', { platform: platformLabel })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Step Progress Bar */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-[#030c1e]/60 border-b border-slate-100 dark:border-[#0e1e40]/60">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-3.5 right-3.5 top-3.5 h-[2px] bg-slate-200 dark:bg-[#0e1e40]" />
            <div
              className="absolute left-3.5 top-3.5 h-[2px] bg-blue-500 transition-all duration-700"
              style={{
                width:
                  step === 0
                    ? '0%'
                    : step >= ALERT_PROGRESS_ICONS.length - 1
                      ? '100%'
                      : `${(step / (ALERT_PROGRESS_ICONS.length - 1)) * 100}%`,
              }}
            />
            {ALERT_PROGRESS_ICONS.map((Icon, i) => {
              const done = step > i;
              const active = step === i;
              return (
                <div key={i} className="relative flex flex-col items-center gap-1.5 z-10">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-500 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/40' : 'bg-white dark:bg-[#050d25] border-slate-200 dark:border-[#0e1e40] text-slate-400'}`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap transition-colors ${done || active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                    {progressLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>
          {isSending && (
            <div className="h-1 rounded-full bg-slate-100 dark:bg-[#0e1e40] overflow-hidden mt-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                style={{ width: `${Math.min((step + 1) * 25, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-[#0e1e40]/80">
          {/* Left — Hateful review */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                <AlertTriangle className="w-3 h-3" />
                {t('modalDetectedReview')}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{review.source}</span>
              <span className="ml-auto text-[11px] text-slate-400">
                {new Date(review.createdAt).toLocaleDateString(siteLocaleToIntlDateTag(locale))}
              </span>
            </div>

            <div className="rounded-xl border-l-4 border-l-red-500 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{review.reviewerName}</p>
                <StarRating rating={review.rating} />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{review.comment}</p>
            </div>

            {/* AI flags if available */}
            {review.analysisResult && (
              <div className="space-y-2">
                <FlagBadges result={review.analysisResult} />
                {review.analysisResult.reason && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-1">
                      {t('modalDiagnostic')}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{review.analysisResult.reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* WhatsApp preview */}
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium mb-2">
                {t('modalWhatsappSimulated')}
              </p>
              <WhatsAppPreview review={review} />
            </div>
          </div>

          {/* Right — Editable AI complaint */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                <FileText className="w-3 h-3" />
                {t('modalComplaintDraft')}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('modalEditable')}</span>
            </div>

            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={13}
              className="w-full rounded-xl border border-slate-200 dark:border-[#0e1e40] bg-slate-50 dark:bg-[#040f2a] text-sm text-slate-800 dark:text-slate-200 p-4 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-colors font-mono"
            />
            <div className="flex items-start gap-2 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/20 p-3">
              <ExternalLink className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                {t('modalClipboardHint', { platform: platformLabel })}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#0e1e40]/80 bg-slate-50/80 dark:bg-[#030c1e] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>{t('modalIrreversible')}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              {t('modalCancel')}
            </button>
            <button
              type="button"
              onClick={() => onSend(editedText)}
              disabled={isSending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {isSending ? t('modalProcessing') : t('modalApproveSend', { platform: platformLabel })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function AlertsPage() {
  const searchParams = useSearchParams();
  const { activeLocationId } = useActiveLocation();
  const highlightedId = searchParams?.get('id') ?? null;
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [planSlug, setPlanSlug] = useState<PlanSlug | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [reviews, setReviews] = useState<AlertReview[]>([]);
  const [negativeReviews, setNegativeReviews] = useState<NegativeAlertReview[]>([]);
  const [negEditId, setNegEditId] = useState<string | null>(null);
  const [negEditText, setNegEditText] = useState('');
  const [negActingId, setNegActingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shieldModalReview, setShieldModalReview] = useState<AlertReview | null>(null);
  const [removalInProgressId, setRemovalInProgressId] = useState<string | null>(null);
  const [removalStep, setRemovalStep] = useState<number>(0);
  // Per-card states
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [ignoringIds, setIgnoringIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<number[]>([]);
  const t = useTranslations('Dashboard.alertsPage');
  const locale = useLocale();
  const intlDate = siteLocaleToIntlDateTag(locale);
  const progressLabels = useMemo(
    () => [
      t('progressDetection'),
      t('progressValidation'),
      t('progressSendGoogle'),
      t('progressVerdict'),
    ],
    [t],
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan, selected_plan, alert_threshold_stars')
        .eq('id', user.id)
        .single();
      const slug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
      setPlanSlug(slug);
      const starThreshold =
        typeof profile?.alert_threshold_stars === 'number' && profile.alert_threshold_stars >= 1
          ? profile.alert_threshold_stars
          : 3;

      let query = supabase
        .from('reviews')
        .select('id, reviewer_name, rating, comment, source, response_text, created_at, is_toxic, toxicity_reason, toxicity_complaint_text, toxicity_legal_argumentation, toxicity_resolved_at')
        .eq('user_id', user.id)
        .eq('is_toxic', true);
      if (activeLocationId === 'profile') {
        query = query.is('establishment_id', null);
      } else if (activeLocationId && /^[0-9a-f-]{36}$/i.test(activeLocationId)) {
        query = query.eq('establishment_id', activeLocationId);
      }
      const { data: rows } = await query.order('created_at', { ascending: false }).limit(100);

      const mapped: AlertReview[] = (rows ?? []).map((r) => ({
        id: String(r.id),
        reviewerName: String(r.reviewer_name ?? t('defaultReviewerName')),
        rating: typeof r.rating === 'number' ? r.rating : 0,
        comment: String(r.comment ?? ''),
        source: String(r.source ?? 'Unknown'),
        responseText: r.response_text ?? null,
        createdAt: typeof r.created_at === 'string' && r.created_at ? r.created_at : new Date().toISOString(),
        isToxic: Boolean(r.is_toxic),
        toxicityReason: (r.toxicity_reason as string | null) ?? null,
        toxicityComplaintText: (r.toxicity_complaint_text as string | null) ?? null,
        toxicityLegalArgumentation: (r.toxicity_legal_argumentation as string | null) ?? null,
        resolved: Boolean(r.toxicity_resolved_at),
      }));
      setReviews(mapped);

      let negQuery = supabase
        .from('reviews')
        .select('id, reviewer_name, rating, comment, source, ai_response, response_text, created_at')
        .eq('user_id', user.id)
        .eq('is_toxic', false)
        .lt('rating', starThreshold)
        .eq('status', 'pending')
        .not('ai_response', 'is', null);
      if (activeLocationId === 'profile') {
        negQuery = negQuery.is('establishment_id', null);
      } else if (activeLocationId && /^[0-9a-f-]{36}$/i.test(activeLocationId)) {
        negQuery = negQuery.eq('establishment_id', activeLocationId);
      }
      const { data: negRows } = await negQuery.order('created_at', { ascending: false }).limit(80);
      setNegativeReviews(
        (negRows ?? []).map((r) => ({
          id: String(r.id),
          reviewerName: String(r.reviewer_name ?? t('defaultReviewerName')),
          rating: typeof r.rating === 'number' ? r.rating : 0,
          comment: String(r.comment ?? ''),
          source: String(r.source ?? 'Unknown'),
          aiResponse: (r.ai_response as string | null) ?? null,
          responseText: (r.response_text as string | null) ?? null,
          createdAt: typeof r.created_at === 'string' && r.created_at ? r.created_at : new Date().toISOString(),
        }))
      );
      setLoading(false);
    });
  }, [activeLocationId, t]);

  useEffect(() => {
    if (!highlightedId || loading) return;
    const highlightTimer = window.setTimeout(() => {
      const el = cardRefs.current[highlightedId];
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-pulse');
      window.setTimeout(() => el.classList.remove('animate-pulse'), 2500);
    }, 150);
    return () => clearTimeout(highlightTimer);
  }, [highlightedId, loading]);

  const hasShield = planSlug !== null && hasFeature(planSlug, FEATURES.SHIELD_HATEFUL);

  const urgentReviews = useMemo(
    () => reviews.filter((r) => r.isToxic && !r.resolved),
    [reviews],
  );

  const resolvedReviews = useMemo(
    () => reviews.filter((r) => r.resolved),
    [reviews],
  );

  // ── AI Analysis ──
  const handleAnalyze = async (review: AlertReview) => {
    if (!hasShield) { setShowUpgradeModal(true); return; }
    if (analyzingIds.has(review.id)) return;

    setAnalyzingIds((prev) => new Set(prev).add(review.id));
    try {
      const res = await fetch('/api/shield/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? t('toastAnalyzeFailed'));
        return;
      }
      const result = await res.json() as ShieldAnalysisResult;
      setReviews((prev) =>
        prev.map((r) =>
          r.id === review.id
            ? { ...r, analysisResult: result, toxicityReason: result.reason || r.toxicityReason, toxicityLegalArgumentation: result.complaintText || r.toxicityLegalArgumentation }
            : r
        )
      );
      const flagCount = Object.values(result.flags).filter(Boolean).length;
      if (flagCount === 0) {
        toast.info(t('toastNoCriticalSignal'));
      } else {
        toast.warning(t('toastSignalsDetected', { count: flagCount }));
      }
    } catch {
      toast.error(t('toastServerError'));
    } finally {
      setAnalyzingIds((prev) => { const next = new Set(prev); next.delete(review.id); return next; });
    }
  };

  // ── Ignore ──
  const handleIgnore = async (review: AlertReview) => {
    if (ignoringIds.has(review.id)) return;
    setIgnoringIds((prev) => new Set(prev).add(review.id));
    try {
      const res = await fetch('/api/shield/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id }),
      });
      if (res.ok) {
        setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, resolved: true } : r)));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toxic-alert-resolved'));
        toast.success(t('toastIgnored'));
      } else {
        toast.error(t('toastIgnoreFailed'));
      }
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setIgnoringIds((prev) => { const next = new Set(prev); next.delete(review.id); return next; });
    }
  };

  // ── Confirm threat → open modal ──
  const handleConfirmThreat = (review: AlertReview) => {
    if (!hasShield) { setShowUpgradeModal(true); return; }
    setShieldModalReview(review);
  };

  // ── Send from modal ──
  const handleSendFromModal = async (customText: string) => {
    const review = shieldModalReview;
    if (!review || !hasShield) { setShowUpgradeModal(true); return; }
    if (removalInProgressId === review.id) return;

    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];

    setRemovalInProgressId(review.id);
    setRemovalStep(1); // Validation Client → in modal = step 1

    const t1 = window.setTimeout(() => setRemovalStep(2), 1000);
    const t2 = window.setTimeout(() => {
      (async () => {
        const { url: reportUrl } = buildReportInfo(review.source, locale, t);
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          try { await navigator.clipboard.writeText(customText); } catch { /* ignore */ }
        }
        if (typeof window !== 'undefined') window.open(reportUrl, '_blank', 'noopener,noreferrer');
        setRemovalStep(3);
        toast.success(t('toastCopiedPaste'));
        try {
          const supabase = createClient();
          await supabase.from('reviews').update({ toxicity_resolved_at: new Date().toISOString() }).eq('id', review.id);
          setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, resolved: true } : r)));
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toxic-alert-resolved'));
        } catch {
          toast.error(t('toastFinalizeError'));
        } finally {
          window.setTimeout(() => {
            setRemovalInProgressId(null);
            setRemovalStep(0);
            setShieldModalReview(null);
          }, 800);
        }
      })();
    }, 2000);

    timeoutsRef.current = [t1, t2];
  };

  const runNegativeAlertAction = async (id: string, action: 'publish_now' | 'edit', responseText?: string) => {
    setNegActingId(id);
    try {
      const body: { action: string; responseText?: string } = { action };
      if (action === 'edit' && responseText) body.responseText = responseText;
      const res = await fetch(`/api/supabase/reviews/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t('toastErrorGeneric'));
      if (action === 'publish_now') {
        setNegativeReviews((prev) => prev.filter((r) => r.id !== id));
        setNegEditId(null);
        toast.success(t('toastPublishQueued'));
      } else if (action === 'edit' && responseText?.trim()) {
        const trimmed = responseText.trim();
        setNegativeReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, aiResponse: trimmed, responseText: trimmed } : r))
        );
        setNegEditId(null);
        toast.success(t('toastReplyEdited'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastErrorGeneric'));
    } finally {
      setNegActingId(null);
    }
  };

  const totalThreats = reviews.length;
  const resolvedCount = resolvedReviews.length;
  const activeCount = urgentReviews.length;
  const dashboardAlertCount = activeCount + negativeReviews.length;

  return (
    <div className="min-h-full bg-slate-50 dark:bg-[#030303]">

      {/* ── Page header ── */}
      <div className="border-b border-slate-200/80 dark:border-white/[0.05] bg-white dark:bg-[#06091a] px-4 sm:px-6 py-5">
        <div className="flex items-start gap-4">
          {/* Radar shield icon */}
          <div className="relative flex-shrink-0 w-12 h-12">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="22" stroke="rgba(239,68,68,0.15)" strokeWidth="1" />
              <circle cx="24" cy="24" r="14" stroke="rgba(239,68,68,0.10)" strokeWidth="0.75" />
              <g className="radar-sweep">
                <defs>
                  <radialGradient id="radarGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(239,68,68,0)" />
                    <stop offset="100%" stopColor="rgba(239,68,68,0.28)" />
                  </radialGradient>
                </defs>
                <path d="M24 24 L24 2 A22 22 0 0 1 43.8 34 Z" fill="url(#radarGrad)" />
                <line x1="24" y1="24" x2="24" y2="2" stroke="rgba(239,68,68,0.5)" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 dark:bg-red-500/[0.08] border border-red-500/20 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-red-500" />
              </div>
            </div>
            {dashboardAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center z-10">
                {dashboardAlertCount > 9 ? t('badgeCountOverflow') : dashboardAlertCount}
              </span>
            )}
          </div>

            <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white">{t('pageTitle')}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 dark:bg-red-500/[0.12] border border-red-500/20 px-2.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {t('badgeActive')}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('pageSubtitle')}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: t('statThreatsDetected'), value: totalThreats, ...ALERT_STAT_CARD_STYLES[0] },
            { label: t('statInProgress'), value: activeCount, ...ALERT_STAT_CARD_STYLES[1] },
            { label: t('statResolved'), value: resolvedCount, ...ALERT_STAT_CARD_STYLES[2] },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 text-center`}>
              <p className={`text-xl font-bold font-display ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 sm:px-6 py-6 space-y-8">
        {loading ? (
          <DashboardInlineLoading />
        ) : (
          <>
            {negativeReviews.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock3 className="w-5 h-5 text-amber-500" aria-hidden />
                    {t('sectionNegativeTitle')}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('sectionNegativeDesc')}
                  </p>
                </div>
                <div className="space-y-4">
                  {negativeReviews.map((r) => {
                    const isNegEditing = negEditId === r.id;
                    const isNegActing = negActingId === r.id;
                    const draft = r.responseText || r.aiResponse;
                    return (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-[#06091a] border-l-4 border-l-amber-500 p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.reviewerName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <StarRating rating={r.rating} />
                              <span className="text-[11px] text-slate-400">{r.source}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg">
                            {t('pendingBadge')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">{r.comment}</p>
                        {isNegEditing ? (
                          <div className="space-y-2 mb-3">
                            <textarea
                              value={negEditText}
                              onChange={(e) => setNegEditText(e.target.value)}
                              rows={4}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#030712] text-sm text-slate-900 dark:text-slate-100"
                            />
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => runNegativeAlertAction(r.id, 'edit', negEditText)}
                                disabled={isNegActing || !negEditText.trim()}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                              >
                                {isNegActing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {t('save')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setNegEditId(null)}
                                className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                              >
                                {t('cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          draft && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5 rounded-xl p-3 mb-3 whitespace-pre-wrap">
                              {draft}
                            </p>
                          )
                        )}
                        {!isNegEditing && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setNegEditId(r.id);
                                setNegEditText(draft ?? '');
                              }}
                              disabled={isNegActing}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                            >
                              <Pencil className="w-4 h-4" />
                              {t('edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => runNegativeAlertAction(r.id, 'publish_now')}
                              disabled={isNegActing || !draft}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {isNegActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              {t('queuePublication')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {urgentReviews.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" aria-hidden />
              {t('sectionToxicTitle')}
            </h2>
            {urgentReviews.map((r) => {
              const borderAccent = toxicCardBorderAccent(r.rating);
              const isHighlighted = highlightedId === r.id;
              const isAnalyzing = analyzingIds.has(r.id);
              const isIgnoring = ignoringIds.has(r.id);
              const isInProgress = removalInProgressId === r.id;
              const hasComplaint = !!(r.toxicityLegalArgumentation || r.toxicityComplaintText || r.analysisResult?.complaintText);

              return (
                <div
                  key={r.id}
                  ref={(el) => { cardRefs.current[r.id] = el; }}
                  className={`rounded-2xl bg-white dark:bg-[#06091a] border border-slate-200 dark:border-white/[0.06] shadow-sm hover:shadow-md dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 border-l-4 ${borderAccent}${isHighlighted ? ' ring-2 ring-red-500/40 ring-offset-2 dark:ring-offset-[#030303]' : ''}`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 p-5 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.reviewerName}</p>
                          <span className="inline-flex items-center rounded-lg bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                            {t('badgeToxic')}
                          </span>
                          <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                            {r.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StarRating rating={r.rating} />
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {new Date(r.createdAt).toLocaleDateString(intlDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/8 dark:bg-red-500/10 border border-red-200 dark:border-red-900/40 rounded-lg px-2 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      {t('badgeCritical')}
                    </span>
                  </div>

                  {/* Review text */}
                  <div className="px-5 pb-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{r.comment}</p>

                    {/* AI analysis result */}
                    {isAnalyzing && (
                      <div className="mt-3">
                        <AnalyzingIndicator />
                      </div>
                    )}
                    {!isAnalyzing && r.analysisResult && (
                      <div className="mt-3 space-y-2">
                        <FlagBadges result={r.analysisResult} />
                        {r.analysisResult.reason && (
                          <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 p-3">
                            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{r.analysisResult.reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {!isAnalyzing && !r.analysisResult && r.toxicityReason && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 p-3">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{r.toxicityReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Sending progress bar */}
                  {isInProgress && (
                    <div className="px-5 pb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        {ALERT_PROGRESS_ICONS.map((Icon, i) => {
                          const done = removalStep > i;
                          const active = removalStep === i;
                          return (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-500 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white shadow shadow-blue-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                                {done ? REMOVAL_PROGRESS_DONE_MARK : <Icon className="w-3 h-3" />}
                              </div>
                              <span className={`text-[9px] font-medium text-center leading-tight ${done || active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                                {progressLabels[i]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700" style={{ width: `${Math.min((removalStep + 1) * 25, 100)}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Card footer — action buttons */}
                  <div className="px-5 pb-5 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {hasComplaint ? t('cardLegalReady') : t('cardRunAnalysis')}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Ignorer */}
                      <button
                        type="button"
                        onClick={() => handleIgnore(r)}
                        disabled={isIgnoring || isInProgress}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-50"
                      >
                        {isIgnoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {t('ignore')}
                      </button>

                      {!r.analysisResult && (
                        <button
                          type="button"
                          onClick={() => handleAnalyze(r)}
                          disabled={isAnalyzing || isInProgress || !hasShield}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50 ${
                            hasShield
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow shadow-blue-500/20'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          {isAnalyzing ? t('analyzeShort') : t('analyzeWithAi')}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleConfirmThreat(r)}
                        disabled={isInProgress}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 ${
                          hasShield
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {hasShield
                          ? isInProgress ? t('inProgress') : t('confirmThreat')
                          : t('planRequired')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
            )}

            {!loading && negativeReviews.length === 0 && urgentReviews.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-12 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-display font-bold text-emerald-800 dark:text-emerald-100">{t('emptyTitle')}</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                {t('emptyDesc')}
                {resolvedCount > 0 ? ` ${t('emptyResolved', { count: resolvedCount })}` : ''}
              </p>
            </div>
          </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {shieldModalReview && (
        <ShieldModal
          key={shieldModalReview.id}
          review={shieldModalReview}
          onClose={() => setShieldModalReview(null)}
          onSend={handleSendFromModal}
          isSending={removalInProgressId === shieldModalReview.id}
          step={removalStep}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal featureKey={FEATURES.SHIELD_HATEFUL} onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
