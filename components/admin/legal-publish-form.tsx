'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Lock,
  Gavel,
  Sparkles,
  Globe,
  Mail,
  Eye,
  ShieldAlert,
  X,
  Clock,
  Zap,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  MonitorSmartphone,
  Scale,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import {
  addDaysToYmd,
  buildEffectiveAtIso,
  formatLegalEffectiveUtcDisplay,
  legalTodayUtc,
  LEGAL_DEFAULT_EFFECTIVE_TIME_UTC,
  LEGAL_MAX_EFFECTIVE_DAYS_AHEAD,
  LEGAL_MIN_NOTICE_DAYS_SCHEDULED,
  parseTimeUtcHm,
  validateLegalEffectiveDate,
  type LegalEffectiveDateTextFns,
} from '@/lib/legal/dates';

// ─── Types ───────────────────────────────────────────────────────────────────

type DocumentType = 'cgu' | 'politique_confidentialite' | 'mentions_legales';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type Language = 'fr' | 'en';
type ActiveModal = 'document' | 'email' | 'consent' | null;

type PreviousVersion = {
  id: string;
  version: number;
  content: string;
  summary_of_changes: string;
  effective_date: string;
  status: string;
};

type SentinelSelfReviewItem = {
  question: string;
  assessment: string;
  risk: 'low' | 'medium' | 'high';
};

type SentinelAnalysis = {
  is_new: boolean;
  diff_summary: string;
  severity: Severity;
  rgpd_alert: boolean;
  rgpd_details?: string | null;
  key_changes?: string[];
  /** Revue structurée (première version ou enrichissement IA) */
  self_review_qa?: SentinelSelfReviewItem[];
};

type PublishResult = {
  success: boolean;
  version?: number;
  status?: string;
  emailsSent?: number;
  emailsFailed?: number;
  totalUsers?: number;
  vectorized?: boolean;
  error?: string;
};

type GuardianDraftPayload = {
  id: string;
  document_type: DocumentType;
  content_html: string;
  summary_of_changes: string;
  admin_verified_at: string | null;
};

function htmlFragmentToEditorText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|br)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGAL_PUBLISH_DRAFT_STORAGE_KEY = 'reputexa_legal_publish_form_draft_v1';

const PREVIEW_CHECKLIST_KEYS = ['document', 'email', 'consent'] as const;

type LegalPublishDraftV1 = {
  v: 1;
  documentType: DocumentType;
  notes: string;
  content: string;
  summary: string;
  effectiveDate: string;
  /** HH:mm interprété comme UTC (aligné API publish). */
  effectiveTimeUtc: string;
  language: Language;
  generatedEmail: string;
  previewChecked: { document: boolean; email: boolean; consent: boolean };
  testEmailSent: boolean;
  sentinelFixBrief: string;
};

function parseStoredLegalDraft(raw: string | null): LegalPublishDraftV1 | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<LegalPublishDraftV1>;
    if (p.v !== 1) return null;
    const dt = p.documentType;
    if (!dt || !['cgu', 'politique_confidentialite', 'mentions_legales'].includes(dt)) return null;
    return {
      v: 1,
      documentType: dt,
      notes: typeof p.notes === 'string' ? p.notes : '',
      content: typeof p.content === 'string' ? p.content : '',
      summary: typeof p.summary === 'string' ? p.summary : '',
      effectiveDate:
        typeof p.effectiveDate === 'string' && p.effectiveDate
          ? p.effectiveDate
          : addDaysToYmd(legalTodayUtc(), LEGAL_MIN_NOTICE_DAYS_SCHEDULED),
      effectiveTimeUtc:
        typeof p.effectiveTimeUtc === 'string' && parseTimeUtcHm(p.effectiveTimeUtc)
          ? p.effectiveTimeUtc
          : LEGAL_DEFAULT_EFFECTIVE_TIME_UTC,
      language: p.language === 'en' ? 'en' : 'fr',
      generatedEmail: typeof p.generatedEmail === 'string' ? p.generatedEmail : '',
      previewChecked: {
        document: !!p.previewChecked?.document,
        email: !!p.previewChecked?.email,
        consent: !!p.previewChecked?.consent,
      },
      testEmailSent: !!p.testEmailSent,
      sentinelFixBrief: typeof p.sentinelFixBrief === 'string' ? p.sentinelFixBrief : '',
    };
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, className = '' }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-800/80 bg-zinc-900/50 ring-1 ring-white/[0.04] ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-800/80">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 border border-zinc-700/50">
          <Icon className="w-3.5 h-3.5 text-zinc-400" />
        </span>
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.12em]">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function AiButton({ onClick, loading, disabled, children, variant = 'default' }: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'purple' | 'teal';
}) {
  const colors = {
    default: 'border-zinc-600 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:text-white',
    purple: 'border-purple-600/50 bg-purple-900/20 text-purple-300 hover:border-purple-500 hover:bg-purple-900/30',
    teal: 'border-teal-600/50 bg-teal-900/20 text-teal-300 hover:border-teal-500 hover:bg-teal-900/30',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${colors[variant]}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

function PreviewModal({ title, children, onClose }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LegalPublishForm({ adminSecret }: { adminSecret: string }) {
  const locale = useLocale();
  const t = useTranslations('Dashboard.legalPublish');
  const tLegalDates = useTranslations('LegalDates');

  const documentTypes = useMemo(
    () =>
      [
        { value: 'cgu' as const, label: t('docType_cgu_short'), fullLabel: t('docType_cgu_full'), icon: FileText },
        {
          value: 'politique_confidentialite' as const,
          label: t('docType_privacy_short'),
          fullLabel: t('docType_privacy_full'),
          icon: Lock,
        },
        {
          value: 'mentions_legales' as const,
          label: t('docType_mentions_short'),
          fullLabel: t('docType_mentions_full'),
          icon: Gavel,
        },
      ] as const,
    [t]
  );

  const severityConfig = useMemo(
    (): Record<
      Severity,
      { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }
    > => ({
      low: {
        label: t('severity_low'),
        color: 'text-emerald-400',
        bg: 'bg-emerald-900/20',
        border: 'border-emerald-700/50',
        icon: Check,
      },
      medium: {
        label: t('severity_medium'),
        color: 'text-yellow-400',
        bg: 'bg-yellow-900/20',
        border: 'border-yellow-700/50',
        icon: Info,
      },
      high: {
        label: t('severity_high'),
        color: 'text-orange-400',
        bg: 'bg-orange-900/20',
        border: 'border-orange-700/50',
        icon: AlertTriangle,
      },
      critical: {
        label: t('severity_critical'),
        color: 'text-red-400',
        bg: 'bg-red-900/20',
        border: 'border-red-700/50',
        icon: ShieldAlert,
      },
    }),
    [t]
  );

  const callAiTools = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const res = await fetch('/api/admin/legal/ai-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ action, ...payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? t('errorAiToolsHttp', { status: res.status })
        );
      }
      return res.json();
    },
    [adminSecret, t]
  );

  const legalDateTexts = useMemo<LegalEffectiveDateTextFns>(
    () => ({
      invalidFormat: () => tLegalDates('invalidFormat'),
      pastDate: () => tLegalDates('pastDate'),
      tooFar: (maxEffective) =>
        tLegalDates('tooFar', { maxEffective, maxDays: LEGAL_MAX_EFFECTIVE_DAYS_AHEAD }),
      noticeNotMet: (earliestScheduled, todayYmd) =>
        tLegalDates('noticeNotMet', {
          earliestScheduled,
          todayYmd,
          minDays: LEGAL_MIN_NOTICE_DAYS_SCHEDULED,
        }),
    }),
    [tLegalDates]
  );

  const today = legalTodayUtc();
  const earliestScheduledDate = addDaysToYmd(today, LEGAL_MIN_NOTICE_DAYS_SCHEDULED);
  const maxEffectiveDate = addDaysToYmd(today, LEGAL_MAX_EFFECTIVE_DAYS_AHEAD);

  // — Form state —
  const [documentType, setDocumentType] = useState<DocumentType>('cgu');
  const [notes, setNotes] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  /** Par défaut : plus tôt PENDING valide (J+préavis), pas une date dans la zone interdite J+1…J+29. */
  const [effectiveDate, setEffectiveDate] = useState(() =>
    addDaysToYmd(legalTodayUtc(), LEGAL_MIN_NOTICE_DAYS_SCHEDULED)
  );
  /** HH:mm interprété comme UTC côté serveur (voir API publish). */
  const [effectiveTimeUtc, setEffectiveTimeUtc] = useState(LEGAL_DEFAULT_EFFECTIVE_TIME_UTC);
  const [language, setLanguage] = useState<Language>('fr');

  // — AI loading states —
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingSentinel, setLoadingSentinel] = useState(false);
  const [loadingSentinelFix, setLoadingSentinelFix] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [loadingEmailDraft, setLoadingEmailDraft] = useState(false);
  const [loadingTestSend, setLoadingTestSend] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);

  // — Data state —
  const [prevVersion, setPrevVersion] = useState<PreviousVersion | null>(null);
  const [sentinel, setSentinel] = useState<SentinelAnalysis | null>(null);
  const [sentinelOpen, setSentinelOpen] = useState(true);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [sentinelFixBrief, setSentinelFixBrief] = useState('');

  // — Preview gate —
  const [previewChecked, setPreviewChecked] = useState({ document: false, email: false, consent: false });
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // — Result —
  const [result, setResult] = useState<PublishResult | null>(null);
  const [guardianDraft, setGuardianDraft] = useState<GuardianDraftPayload | null>(null);
  const [draftBootstrapped, setDraftBootstrapped] = useState(false);
  /** Évite que l'effet [documentType] efface previewChecked juste après restauration localStorage. */
  const skipNextDocumentTypePreviewResetRef = useRef(false);

  const effectiveDateValidation = validateLegalEffectiveDate(effectiveDate, today, legalDateTexts);

  const effectiveAtIso = useMemo(() => {
    if (!effectiveDate || !parseTimeUtcHm(effectiveTimeUtc)) return null;
    try {
      return buildEffectiveAtIso(effectiveDate, effectiveTimeUtc, tLegalDates('invalidUtcTime'));
    } catch {
      return null;
    }
  }, [effectiveDate, effectiveTimeUtc, tLegalDates]);

  const canPublish =
    previewChecked.document &&
    previewChecked.email &&
    previewChecked.consent &&
    effectiveDateValidation.ok &&
    effectiveAtIso != null;

  /** État des clés API côté serveur (Vercel / .env), indépendant de Cursor. */
  const [aiHealth, setAiHealth] = useState<{
    aiConfigured: boolean;
    anthropicConfigured: boolean;
    openaiConfigured: boolean;
    legalAnthropicModel: string | null;
    legalPublisherEnvFilled: number;
    siteUrl: string | null;
  } | null>(null);

  // — Derived —
  const docStatus: 'PENDING' | 'ACTIVE' =
    effectiveAtIso != null && new Date(effectiveAtIso).getTime() > Date.now() ? 'PENDING' : 'ACTIVE';

  const selectedDocType = documentTypes.find((d) => d.value === documentType)!;

  // ── Load previous version when document type changes ─────────────────────
  const loadPreviousVersion = useCallback(async (type: DocumentType) => {
    try {
      const res = await fetch(`/api/admin/legal/ai-tools?document_type=${type}`, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!res.ok) return;
      const { latest } = await res.json();
      setPrevVersion(latest ?? null);
      setSentinel(null);
    } catch {
      setPrevVersion(null);
    }
  }, [adminSecret]);

  useEffect(() => {
    loadPreviousVersion(documentType);
    if (skipNextDocumentTypePreviewResetRef.current) {
      skipNextDocumentTypePreviewResetRef.current = false;
    } else {
      setPreviewChecked({ document: false, email: false, consent: false });
    }
    setResult(null);
  }, [documentType, loadPreviousVersion]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/legal/ai-tools?health=1', {
          headers: { 'x-admin-secret': adminSecret },
        });
        if (res.ok) setAiHealth(await res.json());
      } catch {
        setAiHealth(null);
      }
    })();
  }, [adminSecret]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/legal/guardian-draft', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { draft?: GuardianDraftPayload | null };
        if (cancelled) return;
        const d = j.draft;
        if (d && ['cgu', 'politique_confidentialite', 'mentions_legales'].includes(d.document_type)) {
          setGuardianDraft(d);
        } else {
          setGuardianDraft(null);
        }
      } catch {
        if (!cancelled) setGuardianDraft(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    try {
      const parsed = parseStoredLegalDraft(
        typeof window !== 'undefined' ? localStorage.getItem(LEGAL_PUBLISH_DRAFT_STORAGE_KEY) : null
      );
      if (parsed) {
        skipNextDocumentTypePreviewResetRef.current = true;
        setDocumentType(parsed.documentType);
        setNotes(parsed.notes);
        setContent(parsed.content);
        setSummary(parsed.summary);
        setEffectiveDate(parsed.effectiveDate);
        setEffectiveTimeUtc(parsed.effectiveTimeUtc);
        setLanguage(parsed.language);
        setGeneratedEmail(parsed.generatedEmail);
        setPreviewChecked(parsed.previewChecked);
        setTestEmailSent(parsed.testEmailSent);
        setSentinelFixBrief(parsed.sentinelFixBrief ?? '');
        toast.info(t('toastDraftRestored'));
      }
    } catch {
      /* ignore */
    }
    setDraftBootstrapped(true);
  }, [t]);

  useEffect(() => {
    if (!draftBootstrapped) return;
    const id = setTimeout(() => {
      try {
        const payload: LegalPublishDraftV1 = {
          v: 1,
          documentType,
          notes,
          content,
          summary,
          effectiveDate,
          effectiveTimeUtc,
          language,
          generatedEmail,
          previewChecked,
          testEmailSent,
          sentinelFixBrief,
        };
        localStorage.setItem(LEGAL_PUBLISH_DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* private mode / quota */
      }
    }, 500);
    return () => clearTimeout(id);
  }, [
    draftBootstrapped,
    documentType,
    notes,
    content,
    summary,
    effectiveDate,
    effectiveTimeUtc,
    language,
    generatedEmail,
    previewChecked,
    testEmailSent,
    sentinelFixBrief,
  ]);

  function clearBrowserDraft() {
    try {
      localStorage.removeItem(LEGAL_PUBLISH_DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setDocumentType('cgu');
    setNotes('');
    setContent('');
    setSummary('');
    setEffectiveDate(addDaysToYmd(legalTodayUtc(), LEGAL_MIN_NOTICE_DAYS_SCHEDULED));
    setEffectiveTimeUtc(LEGAL_DEFAULT_EFFECTIVE_TIME_UTC);
    setLanguage('fr');
    setGeneratedEmail('');
    setPreviewChecked({ document: false, email: false, consent: false });
    setTestEmailSent(false);
    setSentinel(null);
    setSentinelFixBrief('');
    setResult(null);
    toast.success(t('toastDraftCleared'));
  }

  function applyGuardianDraftToForm() {
    if (!guardianDraft) return;
    setDocumentType(guardianDraft.document_type);
    setContent(htmlFragmentToEditorText(guardianDraft.content_html));
    setSummary(guardianDraft.summary_of_changes);
    setPreviewChecked({ document: false, email: false, consent: false });
    setResult(null);
  }

  // ── AI: Generate content ─────────────────────────────────────────────────
  async function handleGenerateContent() {
    setLoadingContent(true);
    try {
      const data = await callAiTools('generate_content', {
        document_type: documentType,
        notes: notes.trim() || undefined,
        existing_content: content.trim() || undefined,
      });
      setContent(data.content ?? '');
    } catch (err) {
      toast.error(
        t('toastErrGeneration', { detail: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoadingContent(false);
    }
  }

  // ── AI: Generate summary ─────────────────────────────────────────────────
  async function handleGenerateSummary() {
    setLoadingSummary(true);
    try {
      const data = await callAiTools('generate_summary', {
        document_type: documentType,
        content: content.trim() || undefined,
        existing_summary: summary.trim() || undefined,
        prev_content: prevVersion?.content || undefined,
      });
      setSummary(data.summary ?? '');
    } catch (err) {
      toast.error(
        t('toastErrSummary', { detail: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoadingSummary(false);
    }
  }

  // ── AI: Sentinel analysis ────────────────────────────────────────────────
  async function handleSentinelAnalyze() {
    if (!prevVersion && !content.trim() && !summary.trim()) {
      toast.warning(t('toastWarnSentinelInput'));
      return;
    }
    setLoadingSentinel(true);
    setSentinelOpen(true);
    try {
      const data = await callAiTools('sentinel_analyze', {
        document_type: documentType,
        new_content: content.trim(),
        new_summary: summary.trim(),
        prev_content: prevVersion?.content ?? undefined,
        prev_summary: prevVersion?.summary_of_changes ?? undefined,
      });
      setSentinel(data);
    } catch (err) {
      toast.error(
        t('toastErrSentinel', { detail: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoadingSentinel(false);
    }
  }

  // ── AI: Apply Sentinel-driven fixes to document ───────────────────────────
  async function handleSentinelApplyFixes() {
    if (!content.trim()) {
      toast.warning(t('toastWarnContentForFix'));
      return;
    }
    if (!sentinelFixBrief.trim()) {
      toast.warning(t('toastWarnFixBrief'));
      return;
    }
    setLoadingSentinelFix(true);
    try {
      const sentinel_report = sentinel
        ? JSON.stringify({
            diff_summary: sentinel.diff_summary,
            key_changes: sentinel.key_changes ?? [],
            rgpd_details: sentinel.rgpd_details ?? null,
            self_review_qa: sentinel.self_review_qa ?? [],
          })
        : undefined;
      const data = await callAiTools('sentinel_apply_fixes', {
        document_type: documentType,
        content: content.trim(),
        correction_brief: sentinelFixBrief.trim(),
        sentinel_report,
      });
      const next = typeof data.content === 'string' ? data.content : '';
      if (!next.trim()) {
        toast.error(t('toastErrEmptyAi'));
        return;
      }
      setContent(next);
      setSentinel(null);
      setPreviewChecked((p) => ({ ...p, document: false }));
      toast.success(
        sentinel_report ? t('toastSuccessFixWithSentinel') : t('toastSuccessFixNoSentinel')
      );
    } catch (err) {
      toast.error(
        t('toastErrCorrection', { detail: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoadingSentinelFix(false);
    }
  }

  // ── AI: Translate ────────────────────────────────────────────────────────
  async function handleTranslate() {
    if (!content.trim() && !summary.trim()) return;
    const target: Language = language === 'fr' ? 'en' : 'fr';
    setLoadingTranslate(true);
    try {
      const data = await callAiTools('translate', {
        document_type: documentType,
        content: content.trim() || undefined,
        summary: summary.trim() || undefined,
        target_language: target,
      });
      if (data.content) setContent(data.content);
      if (data.summary) setSummary(data.summary);
      setLanguage(target);
    } catch (err) {
      toast.error(
        t('toastErrTranslate', { detail: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoadingTranslate(false);
    }
  }

  // ── AI: Generate email draft ─────────────────────────────────────────────
  async function handleGenerateEmail() {
    const v = validateLegalEffectiveDate(effectiveDate, today, legalDateTexts);
    if (!summary.trim() || !effectiveDate || !v.ok) {
      toast.warning(v.ok === false ? v.error : t('toastWarnEmailPrereq'));
      return;
    }
    setLoadingEmailDraft(true);
    try {
      const data = await callAiTools('generate_email', {
        document_type: documentType,
        summary: summary.trim(),
        effective_date: effectiveDate,
        effective_time_utc: effectiveTimeUtc,
      });
      setGeneratedEmail(data.email_text ?? '');
    } catch (err) {
      toast.error(
        t('toastErrEmail', { detail: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoadingEmailDraft(false);
    }
  }

  // ── Test email send ──────────────────────────────────────────────────────
  async function handleTestSend() {
    const v = validateLegalEffectiveDate(effectiveDate, today, legalDateTexts);
    if (!summary.trim() || !effectiveDate || !v.ok) {
      toast.warning(v.ok === false ? v.error : t('toastWarnTestEmailPrereq'));
      return;
    }
    setLoadingTestSend(true);
    setTestEmailSent(false);
    try {
      await callAiTools('test_send', {
        document_type: documentType,
        summary: summary.trim(),
        effective_date: effectiveDate,
        effective_time_utc: effectiveTimeUtc,
      });
      setTestEmailSent(true);
      setPreviewChecked((p) => ({ ...p, email: true }));
    } catch (err) {
      toast.error(
        t('toastErrTestSend', { detail: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setLoadingTestSend(false);
    }
  }

  // ── Preview: open modal + mark as checked ────────────────────────────────
  function openModal(type: ActiveModal) {
    setActiveModal(type);
    if (type) {
      setPreviewChecked((p) => ({ ...p, [type]: true }));
    }
  }

  // ── Publish ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateLegalEffectiveDate(effectiveDate, today, legalDateTexts);
    if (!summary.trim() || !effectiveDate) {
      toast.warning(t('toastWarnPublishPrereq'));
      return;
    }
    if (!v.ok) {
      toast.warning(v.error);
      return;
    }
    if (!effectiveAtIso) {
      toast.warning(t('toastWarnUtc'));
      return;
    }

    setLoadingPublish(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/legal/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          document_type: documentType,
          summary_of_changes: summary.trim(),
          effective_date: effectiveDate,
          effective_time_utc: effectiveTimeUtc,
          content: content.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, error: data.error ?? t('errorPublishServer') });
      } else {
        setResult(data);
        try {
          localStorage.removeItem(LEGAL_PUBLISH_DRAFT_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setSummary('');
        setContent('');
        setNotes('');
        setEffectiveDate(addDaysToYmd(legalTodayUtc(), LEGAL_MIN_NOTICE_DAYS_SCHEDULED));
        setEffectiveTimeUtc(LEGAL_DEFAULT_EFFECTIVE_TIME_UTC);
        setSentinel(null);
        setSentinelFixBrief('');
        setGeneratedEmail('');
        setPreviewChecked({ document: false, email: false, consent: false });
        setTestEmailSent(false);
        setLanguage('fr');
        toast.success(t('toastSuccessPublished'));
      }
    } catch {
      setResult({ success: false, error: t('errorPublishNetwork') });
    } finally {
      setLoadingPublish(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const sentinelSev = sentinel ? severityConfig[sentinel.severity] : null;
  const SentinelIcon = sentinelSev?.icon ?? Info;

  const effectiveDateFormatted =
    effectiveAtIso != null ? formatLegalEffectiveUtcDisplay(effectiveAtIso) : '';

  const emailPreviewHtml = useMemo(() => {
    const dateShown = effectiveDateFormatted || t('datePlaceholder');
    const summaryFallback = summary || t('emailPreview_fallbackSummary');
    const bodyMid = generatedEmail
      ? generatedEmail
          .split('\n\n')
          .map(
            (p) =>
              `<p style="color: #374151; font-size: 14px; margin: 0 0 16px;">${p.replace(/\n/g, '<br>')}</p>`
          )
          .join('')
      : `<div style="background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 20px;"><p style="margin: 0; font-size: 14px; color: #1e40af;">${summaryFallback}</p></div>`;
    return `<div style="font-family: system-ui, sans-serif; padding: 24px; background: #f8fafc; min-height: 100%;">
      <div style="max-width: 540px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: #2563eb; padding: 24px; text-align: center;">
          <div style="color: white; font-size: 20px; font-weight: 700;">${t('emailPreview_brand')}</div>
        </div>
        <div style="padding: 28px 24px;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px;">${t('emailPreview_title')}</h2>
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">${t('emailPreview_greeting')}</p>
          <p style="color: #374151; font-size: 14px; margin: 0 0 20px;">${t('emailPreview_bodyLineBefore')}<strong>${dateShown}</strong>${t('emailPreview_bodyLineAfter')}</p>
          ${bodyMid}
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;">${t('emailPreview_cta')}</div>
          </div>
          <p style="margin: 20px 0 0; font-size: 13px; color: #64748b;">${t('emailPreview_signoff')}</p>
        </div>
      </div>
    </div>`;
  }, [effectiveDateFormatted, generatedEmail, summary, t]);

  const consentPreviewHtml = useMemo(() => {
    const dateShown = effectiveDateFormatted || t('datePlaceholder');
    const summaryFallback = summary || t('emailPreview_fallbackSummary');
    return `<div style="font-family: system-ui, sans-serif; padding: 24px; background: rgba(0,0,0,0.6); min-height: 100%; display: flex; align-items: center; justify-content: center;">
      <div style="max-width: 480px; width: 100%; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #eff6ff; border-radius: 12px; margin-bottom: 12px;">
            <span style="font-size: 24px;">📋</span>
          </div>
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">${t('consentPreview_title')}</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0;">${t('consentPreview_effectiveBefore')}<strong>${dateShown}</strong>${t('consentPreview_effectiveAfter')}</p>
        </div>
        <div style="background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
          <p style="font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 8px;">${t('consentPreview_docHeading')}</p>
          <p style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 12px;">${selectedDocType.fullLabel}</p>
          <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.6;">${summaryFallback}</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">${t('consentPreview_accept')}</button>
          <button style="width: 100%; padding: 12px; background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; cursor: pointer;">${t('consentPreview_viewDocs')}</button>
        </div>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 16px 0 0;">${t('consentPreview_footer')}</p>
      </div>
    </div>`;
  }, [effectiveDateFormatted, selectedDocType.fullLabel, summary, t]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminGuidePanel title={t('guideTitle')} variant="compact">
        <ul className="list-disc pl-4 space-y-1.5">
          <li>
            {t.rich('guideBullet1', {
              docType: (c) => <strong className="text-zinc-300">{c}</strong>,
              chg: (c) => <strong className="text-zinc-300">{c}</strong>,
            })}
          </li>
          <li>
            {t.rich('guideBullet2', {
              eff: (c) => <strong className="text-zinc-300">{c}</strong>,
              utc: (c) => <strong className="text-zinc-300">{c}</strong>,
            })}
          </li>
          <li>
            {t.rich('guideBullet3', {
              ai: (c) => <strong className="text-zinc-300">{c}</strong>,
              mod: (c) => <strong className="text-zinc-300">{c}</strong>,
            })}
          </li>
          <li>
            {t.rich('guideBullet4', {
              gd: (c) => <strong className="text-zinc-300">{c}</strong>,
            })}
          </li>
          <li>
            {t.rich('guideBullet5', {
              pub: (c) => <strong className="text-zinc-300">{c}</strong>,
            })}
          </li>
        </ul>
      </AdminGuidePanel>

      <form onSubmit={handleSubmit} className="space-y-5">
        {draftBootstrapped ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-zinc-900/40 px-4 py-2.5 text-[11px] text-zinc-500">
            <span className="flex items-center gap-2 min-w-0">
              <MonitorSmartphone className="w-3.5 h-3.5 shrink-0 text-zinc-600" aria-hidden />
              {t('draftAutoSaveHint')}
            </span>
            <button
              type="button"
              onClick={clearBrowserDraft}
              className="inline-flex items-center gap-1 shrink-0 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:border-red-500/40 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-3 h-3" aria-hidden />
              {t('draftClearButton')}
            </button>
          </div>
        ) : null}
        {guardianDraft ? (
          <div
            id="legal-guardian-draft"
            className="rounded-2xl border border-violet-500/40 bg-violet-500/[0.07] px-4 py-4 space-y-3 scroll-mt-24"
          >
            <p className="text-xs font-semibold text-violet-200 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              {t('guardianCardTitle')}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {t('guardianIdLabel')}{' '}
              <span className="font-mono text-zinc-500">
                {guardianDraft.id.slice(0, 8)}
                {t('textEllipsis')}
              </span>{' '}
              — {guardianDraft.summary_of_changes.slice(0, 220)}
              {guardianDraft.summary_of_changes.length > 220 ? t('textEllipsis') : ''}
            </p>
            {guardianDraft.admin_verified_at ? (
              <p className="text-xs text-emerald-400">
                {t('guardianVerified', {
                  verifiedAt: new Date(guardianDraft.admin_verified_at).toLocaleString(locale, {
                    timeZone: 'UTC',
                  }),
                })}
              </p>
            ) : (
              <p className="text-xs text-amber-400/95">
                {t.rich('guardianComplianceHint', {
                  c: (c) => <strong className="text-amber-200">{c}</strong>,
                })}
              </p>
            )}
            <button
              type="button"
              onClick={applyGuardianDraftToForm}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/50 bg-violet-600/20 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-600/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('guardianImportButton')}
            </button>
          </div>
        ) : null}

        {/* ── 1. Document Type ─────────────────────────────────────────── */}
        <SectionCard title={t('section_docType')} icon={FileText}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {documentTypes.map(({ value, label, fullLabel, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDocumentType(value)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 text-left ${
                  documentType === value
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                }`}
                title={fullLabel}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="leading-tight text-xs">{label}</span>
              </button>
            ))}
          </div>
          {prevVersion && (
            <p className="mt-2.5 text-xs text-zinc-600">
              {t('prevVersionLine', {
                version: prevVersion.version,
                status: prevVersion.status,
                effective: new Date(prevVersion.effective_date).toLocaleDateString(locale, {
                  timeZone: 'UTC',
                }),
              })}
            </p>
          )}
        </SectionCard>

        {/* ── 2. Assistant Magique ─────────────────────────────────────── */}
        <SectionCard title={t('section_assistant')} icon={Sparkles}>
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-100/90 leading-relaxed">
              <Scale className="w-4 h-4 text-amber-400/90 flex-shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-2 min-w-0">
                <p>{t('aiHintParagraph')}</p>
                {aiHealth && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500 border-t border-amber-500/15 pt-2">
                    <span
                      className={
                        aiHealth.aiConfigured
                          ? 'font-semibold text-emerald-400/90'
                          : 'font-semibold text-red-400/90'
                      }
                    >
                      {aiHealth.aiConfigured ? t('serverAiOk') : t('serverAiMissing')}
                    </span>
                    {aiHealth.anthropicConfigured && (
                      <span className="inline-flex items-center gap-0.5 text-zinc-500">
                        <Check className="w-3 h-3 text-emerald-500" aria-hidden /> {t('labelAnthropic')}
                      </span>
                    )}
                    {aiHealth.openaiConfigured && (
                      <span className="inline-flex items-center gap-0.5 text-zinc-500">
                        <Check className="w-3 h-3 text-emerald-500" aria-hidden /> {t('labelOpenaiFallback')}
                      </span>
                    )}
                    {aiHealth.legalAnthropicModel && (
                      <span className="font-mono text-zinc-500 truncate max-w-[200px]" title={aiHealth.legalAnthropicModel}>
                        {t('legalModelLabel', { model: aiHealth.legalAnthropicModel })}
                      </span>
                    )}
                    {aiHealth.legalPublisherEnvFilled > 0 && (
                      <span className="text-zinc-600">
                        {t('legalEnvVarsCount', { count: aiHealth.legalPublisherEnvFilled })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500">
                {t('labelNotesIa')}
                <span className="ml-1 font-normal text-zinc-600">{t('optional')}</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t('placeholderNotesIa')}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-colors resize-none"
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-medium text-zinc-500">
                  {t('labelContentHtml')}
                  <span className="ml-1 font-normal text-zinc-600">{t('labelHtml')}</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <AiButton
                    onClick={handleGenerateContent}
                    loading={loadingContent}
                    variant="purple"
                  >
                    {!loadingContent && <Sparkles className="w-3.5 h-3.5" />}
                    {t('btnGenerateIa')}
                  </AiButton>
                  <AiButton
                    onClick={handleTranslate}
                    loading={loadingTranslate}
                    disabled={!content.trim() && !summary.trim()}
                    variant="teal"
                  >
                    {!loadingTranslate && <Globe className="w-3.5 h-3.5" />}
                    {language === 'fr' ? t('btnTranslateToEn') : t('btnTranslateToFr')}
                  </AiButton>
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder={t('placeholderContentHtml')}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none font-mono"
              />
              {language === 'en' && (
                <p className="text-xs text-teal-400/80 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {t('bannerTranslatedEn')}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── 3. Résumé ────────────────────────────────────────────────── */}
        <SectionCard title={t('section_summary')} icon={FileText}>
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-medium text-zinc-500">
                {t('labelSummaryRequired')} <span className="text-red-400">*</span>
                <span className="ml-1 font-normal text-zinc-600">{t('labelSummaryHint')}</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <AiButton
                  onClick={handleGenerateSummary}
                  loading={loadingSummary}
                  variant="purple"
                >
                  {!loadingSummary && <Sparkles className="w-3.5 h-3.5" />}
                  {t('btnImproveSummary')}
                </AiButton>
                <AiButton
                  onClick={handleGenerateEmail}
                  loading={loadingEmailDraft}
                  disabled={
                    !summary.trim() ||
                    !effectiveDate ||
                    !effectiveDateValidation.ok ||
                    !parseTimeUtcHm(effectiveTimeUtc)
                  }
                  variant="teal"
                >
                  {!loadingEmailDraft && <Mail className="w-3.5 h-3.5" />}
                  {t('btnGenerateClientEmail')}
                </AiButton>
              </div>
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              rows={3}
              placeholder={t('placeholderSummary')}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none"
            />

            {/* Generated email draft */}
            {generatedEmail && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-medium text-teal-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {t('labelEmailDraftGenerated')}
                </p>
                <textarea
                  value={generatedEmail}
                  onChange={(e) => setGeneratedEmail(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-teal-700/40 bg-teal-900/10 px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors resize-none"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 4. Date & Statut ─────────────────────────────────────────── */}
        <SectionCard title={t('section_effectiveDate')} icon={Clock}>
          <p className="text-[11px] text-zinc-500 mb-3">
            {t.rich('introEffectiveDate', {
              d: (c) => <strong className="text-zinc-400">{c}</strong>,
              h: (c) => <strong className="text-zinc-400">{c}</strong>,
              u: (c) => <strong className="text-zinc-400">{c}</strong>,
            })}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="date"
              value={effectiveDate}
              min={today}
              max={maxEffectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
              className={`w-full sm:w-auto rounded-xl border px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors ${
                effectiveDateValidation.ok
                  ? 'border-zinc-700 bg-zinc-800/60 focus:border-blue-500'
                  : 'border-red-600/60 bg-red-950/20 focus:border-red-500'
              }`}
            />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 whitespace-nowrap">{t('labelUtcTime')}</label>
              <input
                type="time"
                step={60}
                value={effectiveTimeUtc}
                onChange={(e) => setEffectiveTimeUtc(e.target.value)}
                className={`rounded-xl border px-3 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors ${
                  parseTimeUtcHm(effectiveTimeUtc)
                    ? 'border-zinc-700 bg-zinc-800/60 focus:border-blue-500'
                    : 'border-red-600/60 bg-red-950/20 focus:border-red-500'
                }`}
                title={t('titleUtcTime')}
              />
            </div>
            {effectiveDate && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                docStatus === 'PENDING'
                  ? 'border-yellow-600/50 bg-yellow-900/20 text-yellow-400'
                  : 'border-emerald-600/50 bg-emerald-900/20 text-emerald-400'
              }`}>
                {docStatus === 'PENDING' ? (
                  <><Clock className="w-3 h-3" /> {t('statusPending', { when: effectiveDateFormatted })}</>
                ) : (
                  <><Zap className="w-3 h-3" /> {t('statusActive')}</>
                )}
              </div>
            )}
          </div>
          {!effectiveDateValidation.ok && (
            <p className="mt-2 text-xs text-red-400">{effectiveDateValidation.error}</p>
          )}
          {effectiveDateValidation.ok && !parseTimeUtcHm(effectiveTimeUtc) && (
            <p className="mt-2 text-xs text-red-400">{t('invalidUtcFormat')}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            {t('helpUtcRule', {
              earliest: earliestScheduledDate,
              minDays: LEGAL_MIN_NOTICE_DAYS_SCHEDULED,
              today,
              maxDate: maxEffectiveDate,
            })}
          </p>
          {docStatus === 'PENDING' && (
            <p className="mt-2 text-xs text-zinc-600">{t('helpPendingModal')}</p>
          )}
        </SectionCard>

        {/* ── 5. Analyse Sentinel ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
            {/* Left: toggle click zone */}
            <button
              type="button"
              onClick={() => setSentinelOpen((o) => !o)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            >
              <ShieldAlert className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.12em]">
                {t('sentinel_title')}
              </span>
              {sentinelSev && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${sentinelSev.bg} ${sentinelSev.border} ${sentinelSev.color}`}>
                  {sentinelSev.label}
                </span>
              )}
              {sentinel?.rgpd_alert && (
                <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/35 bg-red-950/40 text-red-300">
                  <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
                  {t('sentinel_personalDataBadge')}
                </span>
              )}
            </button>
            {/* Right: actions — outside the toggle button */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <AiButton
                onClick={handleSentinelAnalyze}
                loading={loadingSentinel}
                variant="default"
              >
                {!loadingSentinel && <RefreshCw className="w-3.5 h-3.5" />}
                {sentinel ? t('sentinel_rerun') : t('sentinel_analyze')}
              </AiButton>
              <button
                type="button"
                onClick={() => setSentinelOpen((o) => !o)}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {sentinelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {sentinelOpen && (
            <div className="p-5">
              {!sentinel && !loadingSentinel && (
                <p className="text-xs text-zinc-500 text-center py-4 leading-relaxed max-w-md mx-auto">
                  {t.rich('sentinel_emptyHint', {
                    fv: (c) => <strong className="text-zinc-400 font-semibold">{c}</strong>,
                    rv: (c) => <strong className="text-zinc-400 font-semibold">{c}</strong>,
                  })}
                </p>
              )}
              {loadingSentinel && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  {t('sentinel_loading')}
                </div>
              )}
              {sentinel && !loadingSentinel && (
                <div className="space-y-3">
                  {/* Diff summary */}
                  <div className={`rounded-xl border p-4 ${sentinelSev?.bg} ${sentinelSev?.border}`}>
                    <div className="flex items-start gap-2">
                      <SentinelIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${sentinelSev?.color}`} />
                      <div>
                        <p className={`text-xs font-semibold mb-1 ${sentinelSev?.color}`}>
                          {t('sentinel_severityLine', { label: sentinelSev?.label ?? '' })}
                          {sentinel.is_new ? t('sentinel_firstVersionSuffix') : ''}
                        </p>
                        <p className="text-xs text-zinc-300 leading-relaxed">{sentinel.diff_summary}</p>
                      </div>
                    </div>
                  </div>

                  {/* Key changes */}
                  {sentinel.key_changes && sentinel.key_changes.length > 0 && (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4">
                      <p className="text-xs font-semibold text-zinc-400 mb-2">
                        {sentinel.is_new ? t('sentinel_keyChangesNew') : t('sentinel_keyChangesDiff')}
                      </p>
                      <ul className="space-y-1">
                        {sentinel.key_changes.map((change, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                            <span className="text-zinc-600 mt-0.5">•</span>
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sentinel.self_review_qa && sentinel.self_review_qa.length > 0 && (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-4 space-y-3">
                      <p className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                        <Scale className="w-3.5 h-3.5 text-zinc-500" aria-hidden />
                        {t('sentinel_selfReviewTitle')}
                      </p>
                      <ul className="space-y-2.5">
                        {sentinel.self_review_qa.map((item, i) => (
                          <li
                            key={i}
                            className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
                              item.risk === 'high'
                                ? 'border-orange-700/40 bg-orange-950/20 text-orange-100/90'
                                : item.risk === 'low'
                                  ? 'border-emerald-800/35 bg-emerald-950/15 text-emerald-100/90'
                                  : 'border-yellow-800/35 bg-yellow-950/15 text-yellow-100/90'
                            }`}
                          >
                            <span className="font-semibold text-[10px] uppercase tracking-wide text-zinc-400 block mb-1">
                              {item.risk === 'high'
                                ? t('sentinelRisk_high')
                                : item.risk === 'low'
                                  ? t('sentinelRisk_low')
                                  : t('sentinelRisk_medium')}
                            </span>
                            <p className="text-zinc-200/95 font-medium mb-1">{item.question}</p>
                            <p className="text-zinc-400">{item.assessment}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* RGPD alert */}
                  {sentinel.rgpd_alert && (
                    <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-red-300 mb-1 tracking-tight">{t('sentinel_rgpdTitle')}</p>
                          <p className="text-xs text-red-300/80 leading-relaxed">
                            {sentinel.rgpd_details || t('sentinel_rgpdFallback')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-zinc-800 space-y-3">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.12em] flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-violet-400" aria-hidden />
                  {t('sentinel_fixTitle')}
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {t.rich('sentinel_fixIntro', {
                    d: (c) => <strong className="text-zinc-400 font-medium">{c}</strong>,
                    h: (c) => <strong className="text-zinc-400 font-medium">{c}</strong>,
                    an: (c) => <strong className="text-zinc-400 font-medium">{c}</strong>,
                  })}
                </p>
                {sentinel ? (
                  <p className="text-[10px] text-violet-400/90 font-medium">{t('sentinel_fixWithReport')}</p>
                ) : (
                  <p className="text-[10px] text-zinc-600">{t('sentinel_fixNoReport')}</p>
                )}
                <textarea
                  value={sentinelFixBrief}
                  onChange={(e) => setSentinelFixBrief(e.target.value)}
                  rows={6}
                  placeholder={t('placeholderSentinelFix')}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors resize-y min-h-[120px] font-mono text-[13px] leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <AiButton
                    onClick={handleSentinelApplyFixes}
                    loading={loadingSentinelFix}
                    disabled={!content.trim() || !sentinelFixBrief.trim()}
                    variant="purple"
                  >
                    {!loadingSentinelFix && <Wand2 className="w-3.5 h-3.5" />}
                    {t('btnApplyHtmlFix')}
                  </AiButton>
                  {loadingSentinelFix && (
                    <span className="text-[11px] text-zinc-500">{t('sentinel_fixLoadingHint')}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 6. Aperçu & Validation ───────────────────────────────────── */}
        <SectionCard title={t('section_previews')} icon={Eye}>
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 leading-relaxed">{t('previewsIntro')}</p>

            {/* Preview buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Document preview */}
              <button
                type="button"
                onClick={() => openModal('document')}
                disabled={!content.trim()}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                  previewChecked.document
                    ? 'border-emerald-600/50 bg-emerald-900/20 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {previewChecked.document ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                <span className="text-xs font-medium">{t('preview_doc_title')}</span>
                <span className="text-xs text-zinc-600">{t('preview_doc_sub')}</span>
              </button>

              {/* Email test */}
              <button
                type="button"
                onClick={handleTestSend}
                disabled={
                  loadingTestSend ||
                  !summary.trim() ||
                  !effectiveDate ||
                  !effectiveDateValidation.ok ||
                  !parseTimeUtcHm(effectiveTimeUtc)
                }
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                  previewChecked.email
                    ? 'border-emerald-600/50 bg-emerald-900/20 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {loadingTestSend ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : previewChecked.email ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
                <span className="text-xs font-medium">
                  {loadingTestSend ? t('preview_email_loading') : t('preview_email_title')}
                </span>
                <span className="text-xs text-zinc-600">
                  {testEmailSent ? t('preview_email_sent') : t('preview_email_hint')}
                </span>
              </button>

              {/* Consent modal preview */}
              <button
                type="button"
                onClick={() => openModal('consent')}
                disabled={!summary.trim()}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                  previewChecked.consent
                    ? 'border-emerald-600/50 bg-emerald-900/20 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                {previewChecked.consent ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <MonitorSmartphone className="w-5 h-5" />
                )}
                <span className="text-xs font-medium">{t('preview_consent_title')}</span>
                <span className="text-xs text-zinc-600">{t('preview_consent_sub')}</span>
              </button>
            </div>

            {/* Validation checklist */}
            <div className="flex items-center gap-4 flex-wrap">
              {PREVIEW_CHECKLIST_KEYS.map((key) => (
                <div key={key} className={`flex items-center gap-1.5 text-xs ${previewChecked[key] ? 'text-emerald-400' : 'text-zinc-600'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${previewChecked[key] ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`}>
                    {previewChecked[key] && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {key === 'document' && t('checklist_doc')}
                  {key === 'email' && t('checklist_email')}
                  {key === 'consent' && t('checklist_consent')}
                </div>
              ))}
              {!canPublish && (
                <span className="text-xs text-zinc-600 ml-auto">
                  {t('previewsRemaining', {
                    n: 3 - Object.values(previewChecked).filter(Boolean).length,
                  })}
                </span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── Result feedback ───────────────────────────────────────────── */}
        {result && (
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              result.success
                ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300'
                : 'border-red-700/50 bg-red-900/20 text-red-300'
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
            )}
            <div className="space-y-0.5">
              {result.success ? (
                <>
                  <p className="font-semibold">
                    {t('result_versionPublished', {
                      version: result.version ?? 0,
                      status: result.status ?? '',
                    })}
                  </p>
                  <p className="text-emerald-400/80 text-xs">
                    {result.status === 'PENDING'
                      ? t('result_pendingNoEmail')
                      : (result.emailsSent ?? 0) !== 1
                        ? t('result_emails_other', {
                            emailsSent: result.emailsSent ?? 0,
                            totalUsers: result.totalUsers ?? 0,
                          })
                        : t('result_emails_one', {
                            emailsSent: result.emailsSent ?? 0,
                            totalUsers: result.totalUsers ?? 0,
                          })}
                    {result.vectorized && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-purple-400/85">
                        {t('result_vectorized')} <Check className="w-3 h-3" aria-hidden />
                      </span>
                    )}
                    {(result.emailsFailed ?? 0) > 0 && (
                      <span className="text-amber-400 ml-1">
                        {(result.emailsFailed ?? 0) > 1
                          ? t('result_failed_other', { n: result.emailsFailed ?? 0 })
                          : t('result_failed_one', { n: result.emailsFailed ?? 0 })}
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <p>{result.error}</p>
              )}
            </div>
          </div>
        )}

        {/* ── 7. Publish button ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={
              loadingPublish || !summary.trim() || !effectiveDate || !effectiveDateValidation.ok || !canPublish
            }
            title={!canPublish ? t('publishDisabledTitle') : undefined}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 active:scale-[0.98] transition-all duration-150"
          >
            {loadingPublish ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('publish_loading')}</>
            ) : (
              <><Send className="w-4 h-4" /> {t('publish_cta')}</>
            )}
          </button>
          {!canPublish && (
            <p className="text-xs text-zinc-600 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {t('publish_lockedHint')}
            </p>
          )}
          {canPublish && !loadingPublish && (
            <p className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {t('publish_ready')}
            </p>
          )}
        </div>
      </form>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Document preview modal */}
      {activeModal === 'document' && (
        <PreviewModal
          title={t('modal_doc_title', { doc: selectedDocType.fullLabel })}
          onClose={() => setActiveModal(null)}
        >
          <div className="p-5">
            {content.trim() ? (
              <div
                className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-zinc-900 rounded-xl p-5 border border-zinc-800 [&_h2]:text-zinc-100 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:text-zinc-200 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-3 [&_p]:text-zinc-400 [&_p]:text-sm [&_p]:leading-relaxed [&_ul]:text-zinc-400 [&_li]:text-sm [&_strong]:text-zinc-200"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <p className="text-sm text-zinc-500 text-center py-8">{t('modal_doc_empty')}</p>
            )}
          </div>
        </PreviewModal>
      )}

      {/* Email preview modal */}
      {activeModal === 'email' && (
        <PreviewModal
          title={t('modal_email_title')}
          onClose={() => setActiveModal(null)}
        >
          <div
            className="min-h-64"
            dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
          />
        </PreviewModal>
      )}

      {/* Consent modal preview */}
      {activeModal === 'consent' && (
        <PreviewModal
          title={t('modal_consent_title')}
          onClose={() => setActiveModal(null)}
        >
          <div
            className="min-h-64"
            dangerouslySetInnerHTML={{ __html: consentPreviewHtml }}
          />
        </PreviewModal>
      )}
    </>
  );
}
