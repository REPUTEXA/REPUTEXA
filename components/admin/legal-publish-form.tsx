'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';

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

type SentinelAnalysis = {
  is_new: boolean;
  diff_summary: string;
  severity: Severity;
  rgpd_alert: boolean;
  rgpd_details?: string | null;
  key_changes?: string[];
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'cgu' as const, label: "CGU", fullLabel: "Conditions Générales d'Utilisation", icon: FileText },
  { value: 'politique_confidentialite' as const, label: 'Confidentialité', fullLabel: 'Politique de Confidentialité', icon: Lock },
  { value: 'mentions_legales' as const, label: 'Mentions Légales', fullLabel: 'Mentions Légales', icon: Gavel },
];

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  low:      { label: 'Faible',    color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/50', icon: Check },
  medium:   { label: 'Modéré',    color: 'text-yellow-400',  bg: 'bg-yellow-900/20',  border: 'border-yellow-700/50', icon: Info },
  high:     { label: 'Élevé',     color: 'text-orange-400',  bg: 'bg-orange-900/20',  border: 'border-orange-700/50', icon: AlertTriangle },
  critical: { label: 'Critique',  color: 'text-red-400',     bg: 'bg-red-900/20',     border: 'border-red-700/50',    icon: ShieldAlert },
};

// ─── Helper: callAiTools ──────────────────────────────────────────────────────

async function callAiTools(adminSecret: string, action: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/legal/ai-tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Erreur ${res.status}`);
  }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, className = '' }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800">
        <Icon className="w-4 h-4 text-zinc-400" />
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{title}</span>
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
  const today = new Date().toISOString().split('T')[0];

  // — Form state —
  const [documentType, setDocumentType] = useState<DocumentType>('cgu');
  const [notes, setNotes] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [language, setLanguage] = useState<Language>('fr');

  // — AI loading states —
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingSentinel, setLoadingSentinel] = useState(false);
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

  // — Preview gate —
  const [previewChecked, setPreviewChecked] = useState({ document: false, email: false, consent: false });
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const canPublish = previewChecked.document && previewChecked.email && previewChecked.consent;

  // — Result —
  const [result, setResult] = useState<PublishResult | null>(null);

  // — Derived —
  const docStatus: 'PENDING' | 'ACTIVE' =
    effectiveDate && effectiveDate > today ? 'PENDING' : 'ACTIVE';

  const selectedDocType = DOCUMENT_TYPES.find((d) => d.value === documentType)!;

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
    setPreviewChecked({ document: false, email: false, consent: false });
    setResult(null);
  }, [documentType, loadPreviousVersion]);

  // ── AI: Generate content ─────────────────────────────────────────────────
  async function handleGenerateContent() {
    setLoadingContent(true);
    try {
      const data = await callAiTools(adminSecret, 'generate_content', {
        document_type: documentType,
        notes: notes.trim() || undefined,
        existing_content: content.trim() || undefined,
      });
      setContent(data.content ?? '');
    } catch (err) {
      alert(`Erreur génération : ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoadingContent(false);
    }
  }

  // ── AI: Generate summary ─────────────────────────────────────────────────
  async function handleGenerateSummary() {
    setLoadingSummary(true);
    try {
      const data = await callAiTools(adminSecret, 'generate_summary', {
        document_type: documentType,
        content: content.trim() || undefined,
        existing_summary: summary.trim() || undefined,
        prev_content: prevVersion?.content || undefined,
      });
      setSummary(data.summary ?? '');
    } catch (err) {
      alert(`Erreur résumé : ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoadingSummary(false);
    }
  }

  // ── AI: Sentinel analysis ────────────────────────────────────────────────
  async function handleSentinelAnalyze() {
    if (!prevVersion && !content && !summary) return;
    setLoadingSentinel(true);
    setSentinelOpen(true);
    try {
      const data = await callAiTools(adminSecret, 'sentinel_analyze', {
        document_type: documentType,
        new_content: content.trim(),
        new_summary: summary.trim(),
        prev_content: prevVersion?.content ?? undefined,
        prev_summary: prevVersion?.summary_of_changes ?? undefined,
      });
      setSentinel(data);
    } catch (err) {
      alert(`Erreur Sentinel : ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoadingSentinel(false);
    }
  }

  // ── AI: Translate ────────────────────────────────────────────────────────
  async function handleTranslate() {
    if (!content.trim() && !summary.trim()) return;
    const target: Language = language === 'fr' ? 'en' : 'fr';
    setLoadingTranslate(true);
    try {
      const data = await callAiTools(adminSecret, 'translate', {
        document_type: documentType,
        content: content.trim() || undefined,
        summary: summary.trim() || undefined,
        target_language: target,
      });
      if (data.content) setContent(data.content);
      if (data.summary) setSummary(data.summary);
      setLanguage(target);
    } catch (err) {
      alert(`Erreur traduction : ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoadingTranslate(false);
    }
  }

  // ── AI: Generate email draft ─────────────────────────────────────────────
  async function handleGenerateEmail() {
    if (!summary.trim() || !effectiveDate) {
      alert('Veuillez renseigner le résumé et la date d\'entrée en vigueur avant de générer l\'email.');
      return;
    }
    setLoadingEmailDraft(true);
    try {
      const data = await callAiTools(adminSecret, 'generate_email', {
        document_type: documentType,
        summary: summary.trim(),
        effective_date: effectiveDate,
      });
      setGeneratedEmail(data.email_text ?? '');
    } catch (err) {
      alert(`Erreur email : ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoadingEmailDraft(false);
    }
  }

  // ── Test email send ──────────────────────────────────────────────────────
  async function handleTestSend() {
    if (!summary.trim() || !effectiveDate) {
      alert('Résumé et date d\'entrée en vigueur requis pour l\'aperçu email.');
      return;
    }
    setLoadingTestSend(true);
    setTestEmailSent(false);
    try {
      await callAiTools(adminSecret, 'test_send', {
        document_type: documentType,
        summary: summary.trim(),
        effective_date: effectiveDate,
      });
      setTestEmailSent(true);
      setPreviewChecked((p) => ({ ...p, email: true }));
    } catch (err) {
      alert(`Erreur test envoi : ${err instanceof Error ? err.message : err}`);
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
    if (!summary.trim() || !effectiveDate) return;

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
          content: content.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, error: data.error ?? 'Erreur serveur' });
      } else {
        setResult(data);
        setSummary('');
        setContent('');
        setNotes('');
        setEffectiveDate('');
        setSentinel(null);
        setGeneratedEmail('');
        setPreviewChecked({ document: false, email: false, consent: false });
        setTestEmailSent(false);
        setLanguage('fr');
      }
    } catch {
      setResult({ success: false, error: 'Erreur réseau. Réessayez.' });
    } finally {
      setLoadingPublish(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const sentinelSev = sentinel ? SEVERITY_CONFIG[sentinel.severity] : null;
  const SentinelIcon = sentinelSev?.icon ?? Info;

  const effectiveDateFormatted = effectiveDate
    ? new Date(effectiveDate).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      })
    : '';

  // HTML preview for email modal
  const emailPreviewHtml = `
    <div style="font-family: system-ui, sans-serif; padding: 24px; background: #f8fafc; min-height: 100%;">
      <div style="max-width: 540px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: #2563eb; padding: 24px; text-align: center;">
          <div style="color: white; font-size: 20px; font-weight: 700;">REPUTEXA</div>
        </div>
        <div style="padding: 28px 24px;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px;">Mise à jour de nos conditions juridiques</h2>
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Bonjour,</p>
          <p style="color: #374151; font-size: 14px; margin: 0 0 20px;">Ces changements entrent en vigueur le <strong>${effectiveDateFormatted || '[date]'}</strong>.</p>
          ${generatedEmail
            ? generatedEmail.split('\n\n').map(p => `<p style="color: #374151; font-size: 14px; margin: 0 0 16px;">${p.replace(/\n/g, '<br>')}</p>`).join('')
            : `<div style="background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 20px;"><p style="margin: 0; font-size: 14px; color: #1e40af;">${summary || '(résumé des changements)'}</p></div>`
          }
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;">Consulter les documents légaux</div>
          </div>
          <p style="margin: 20px 0 0; font-size: 13px; color: #64748b;">— L'équipe REPUTEXA</p>
        </div>
      </div>
    </div>
  `;

  // Consent modal simulation
  const consentPreviewHtml = `
    <div style="font-family: system-ui, sans-serif; padding: 24px; background: rgba(0,0,0,0.6); min-height: 100%; display: flex; align-items: center; justify-content: center;">
      <div style="max-width: 480px; width: 100%; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #eff6ff; border-radius: 12px; margin-bottom: 12px;">
            <span style="font-size: 24px;">📋</span>
          </div>
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">Mise à jour de nos conditions</h2>
          <p style="font-size: 13px; color: #64748b; margin: 0;">En vigueur à partir du <strong>${effectiveDateFormatted || '[date]'}</strong></p>
        </div>
        <div style="background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
          <p style="font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 8px;">Document mis à jour :</p>
          <p style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 12px;">${selectedDocType.fullLabel}</p>
          <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.6;">${summary || '(résumé des changements)'}</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">J'accepte les nouvelles conditions</button>
          <button style="width: 100%; padding: 12px; background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; cursor: pointer;">Consulter les documents</button>
        </div>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 16px 0 0;">En continuant à utiliser REPUTEXA, vous acceptez les nouvelles conditions.</p>
      </div>
    </div>
  `;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── 1. Document Type ─────────────────────────────────────────── */}
        <SectionCard title="Type de document" icon={FileText}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DOCUMENT_TYPES.map(({ value, label, fullLabel, icon: Icon }) => (
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
              Version actuelle : <span className="text-zinc-400">v{prevVersion.version}</span>
              {' '}— Statut : <span className={prevVersion.status === 'ACTIVE' ? 'text-emerald-400' : 'text-yellow-400'}>{prevVersion.status}</span>
              {' '}— Effective : {new Date(prevVersion.effective_date).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
            </p>
          )}
        </SectionCard>

        {/* ── 2. Assistant Magique ─────────────────────────────────────── */}
        <SectionCard title="Assistant Magique — Contenu" icon={Sparkles}>
          <div className="space-y-4">
            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500">
                Notes &amp; instructions pour l&apos;IA
                <span className="ml-1 font-normal text-zinc-600">(optionnel)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex : Ajouter une clause sur l'utilisation de l'IA, préciser les délais de rétention à 3 ans, mettre à jour l'adresse du DPO..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-colors resize-none"
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-medium text-zinc-500">
                  Contenu complet du document
                  <span className="ml-1 font-normal text-zinc-600">(HTML)</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <AiButton
                    onClick={handleGenerateContent}
                    loading={loadingContent}
                    variant="purple"
                  >
                    {!loadingContent && <Sparkles className="w-3.5 h-3.5" />}
                    ✨ Générer avec l&apos;IA
                  </AiButton>
                  <AiButton
                    onClick={handleTranslate}
                    loading={loadingTranslate}
                    disabled={!content.trim() && !summary.trim()}
                    variant="teal"
                  >
                    {!loadingTranslate && <Globe className="w-3.5 h-3.5" />}
                    🌍 {language === 'fr' ? 'Traduire → EN' : 'Traduire → FR'}
                  </AiButton>
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Collez ou générez le contenu HTML du document ici..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none font-mono"
              />
              {language === 'en' && (
                <p className="text-xs text-teal-400/80 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Document traduit en anglais
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── 3. Résumé ────────────────────────────────────────────────── */}
        <SectionCard title="Résumé des changements" icon={FileText}>
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-medium text-zinc-500">
                Résumé <span className="text-red-400">*</span>
                <span className="ml-1 font-normal text-zinc-600">— affiché dans l&apos;email &amp; la modale de consentement</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <AiButton
                  onClick={handleGenerateSummary}
                  loading={loadingSummary}
                  variant="purple"
                >
                  {!loadingSummary && <Sparkles className="w-3.5 h-3.5" />}
                  ✨ Améliorer avec l&apos;IA
                </AiButton>
                <AiButton
                  onClick={handleGenerateEmail}
                  loading={loadingEmailDraft}
                  disabled={!summary.trim() || !effectiveDate}
                  variant="teal"
                >
                  {!loadingEmailDraft && <Mail className="w-3.5 h-3.5" />}
                  📧 Générer Email Client
                </AiButton>
              </div>
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              rows={3}
              placeholder="Ex : Ajout des clauses relatives à l'utilisation de l'IA, mise à jour des délais de traitement des données personnelles..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none"
            />

            {/* Generated email draft */}
            {generatedEmail && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-medium text-teal-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Brouillon email client généré
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
        <SectionCard title="Date d'entrée en vigueur" icon={Clock}>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="date"
              value={effectiveDate}
              min={today}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
              className="w-full sm:w-auto rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
            />
            {effectiveDate && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                docStatus === 'PENDING'
                  ? 'border-yellow-600/50 bg-yellow-900/20 text-yellow-400'
                  : 'border-emerald-600/50 bg-emerald-900/20 text-emerald-400'
              }`}>
                {docStatus === 'PENDING' ? (
                  <><Clock className="w-3 h-3" /> PENDING — Entrera en vigueur le {effectiveDateFormatted}</>
                ) : (
                  <><Zap className="w-3 h-3" /> ACTIVE — Entre en vigueur immédiatement</>
                )}
              </div>
            )}
          </div>
          {docStatus === 'PENDING' && (
            <p className="mt-2 text-xs text-zinc-600">
              Les emails seront envoyés à la publication. Le document sera automatiquement activé à la date prévue.
            </p>
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
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                Analyse Sentinel
              </span>
              {sentinelSev && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${sentinelSev.bg} ${sentinelSev.border} ${sentinelSev.color}`}>
                  {sentinelSev.label}
                </span>
              )}
              {sentinel?.rgpd_alert && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-red-600/50 bg-red-900/20 text-red-400">
                  ⚠ RGPD
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
                {sentinel ? 'Relancer' : 'Analyser'}
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
                <p className="text-xs text-zinc-600 text-center py-4">
                  Cliquez sur &quot;Analyser&quot; pour comparer avec la version précédente et obtenir le badge de sévérité + alerte RGPD.
                </p>
              )}
              {loadingSentinel && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  Analyse Sentinel en cours…
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
                          Sévérité : {sentinelSev?.label}
                          {sentinel.is_new && ' — Nouveau document'}
                        </p>
                        <p className="text-xs text-zinc-300 leading-relaxed">{sentinel.diff_summary}</p>
                      </div>
                    </div>
                  </div>

                  {/* Key changes */}
                  {sentinel.key_changes && sentinel.key_changes.length > 0 && (
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4">
                      <p className="text-xs font-semibold text-zinc-400 mb-2">Changements clés :</p>
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

                  {/* RGPD alert */}
                  {sentinel.rgpd_alert && (
                    <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-red-400 mb-1">⚠ Alerte RGPD détectée</p>
                          <p className="text-xs text-red-300/80 leading-relaxed">
                            {sentinel.rgpd_details || 'Des modifications pouvant impacter la conformité RGPD ont été détectées. Vérifiez avec votre DPO avant publication.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 6. Aperçu & Validation ───────────────────────────────────── */}
        <SectionCard title="Aperçu & Validation — Look Before You Leap" icon={Eye}>
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Consultez les 3 aperçus avant de pouvoir publier. Le bouton &quot;Publier&quot; restera grisé jusqu&apos;à validation complète.
            </p>

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
                <span className="text-xs font-medium">Aperçu Document</span>
                <span className="text-xs text-zinc-600">Rendu HTML réel</span>
              </button>

              {/* Email test */}
              <button
                type="button"
                onClick={handleTestSend}
                disabled={loadingTestSend || !summary.trim() || !effectiveDate}
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
                  {loadingTestSend ? 'Envoi…' : 'Aperçu Email'}
                </span>
                <span className="text-xs text-zinc-600">
                  {testEmailSent ? '✓ Envoyé à votre adresse admin' : 'Test-Send → Admin uniquement'}
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
                <span className="text-xs font-medium">Aperçu Consentement</span>
                <span className="text-xs text-zinc-600">Modale utilisateur</span>
              </button>
            </div>

            {/* Validation checklist */}
            <div className="flex items-center gap-4 flex-wrap">
              {(['document', 'email', 'consent'] as const).map((key) => (
                <div key={key} className={`flex items-center gap-1.5 text-xs ${previewChecked[key] ? 'text-emerald-400' : 'text-zinc-600'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${previewChecked[key] ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`}>
                    {previewChecked[key] && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {key === 'document' && 'Document'}
                  {key === 'email' && 'Email'}
                  {key === 'consent' && 'Consentement'}
                </div>
              ))}
              {!canPublish && (
                <span className="text-xs text-zinc-600 ml-auto">
                  {3 - Object.values(previewChecked).filter(Boolean).length} aperçu(s) restant(s)
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
                    Version {result.version} publiée —{' '}
                    <span className={result.status === 'PENDING' ? 'text-yellow-400' : 'text-emerald-400'}>
                      {result.status}
                    </span>
                  </p>
                  <p className="text-emerald-400/80 text-xs">
                    {result.status === 'PENDING'
                      ? `Document en attente d'activation. Aucun email envoyé (date future).`
                      : `${result.emailsSent} email${(result.emailsSent ?? 0) > 1 ? 's' : ''} envoyé${(result.emailsSent ?? 0) > 1 ? 's' : ''} sur ${result.totalUsers} utilisateurs.`
                    }
                    {result.vectorized && <span className="ml-2 text-purple-400/80">· Indexé RAG ✓</span>}
                    {(result.emailsFailed ?? 0) > 0 && (
                      <span className="text-amber-400 ml-1">
                        · {result.emailsFailed} échoué{(result.emailsFailed ?? 0) > 1 ? 's' : ''}
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
            disabled={loadingPublish || !summary.trim() || !effectiveDate || !canPublish}
            title={!canPublish ? 'Consultez les 3 aperçus pour débloquer la publication' : undefined}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 active:scale-[0.98] transition-all duration-150"
          >
            {loadingPublish ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Publication en cours…</>
            ) : (
              <><Send className="w-4 h-4" /> Publier &amp; Notifier</>
            )}
          </button>
          {!canPublish && (
            <p className="text-xs text-zinc-600 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Consultez les 3 aperçus pour déverrouiller
            </p>
          )}
          {canPublish && !loadingPublish && (
            <p className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Prêt à publier
            </p>
          )}
        </div>
      </form>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Document preview modal */}
      {activeModal === 'document' && (
        <PreviewModal
          title={`Aperçu Document — ${selectedDocType.fullLabel}`}
          onClose={() => setActiveModal(null)}
        >
          <div className="p-5">
            {content.trim() ? (
              <div
                className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-zinc-900 rounded-xl p-5 border border-zinc-800 [&_h2]:text-zinc-100 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:text-zinc-200 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-3 [&_p]:text-zinc-400 [&_p]:text-sm [&_p]:leading-relaxed [&_ul]:text-zinc-400 [&_li]:text-sm [&_strong]:text-zinc-200"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <p className="text-sm text-zinc-500 text-center py-8">Aucun contenu saisi. Générez ou collez le contenu HTML.</p>
            )}
          </div>
        </PreviewModal>
      )}

      {/* Email preview modal */}
      {activeModal === 'email' && (
        <PreviewModal
          title="Aperçu Email — Rendu client"
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
          title="Aperçu Modale de Consentement — Vue utilisateur"
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
