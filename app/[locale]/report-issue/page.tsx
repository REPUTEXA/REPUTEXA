'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  Bug,
  AlertTriangle,
  Zap,
  Info,
  CheckCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getReportIssuePublicContent } from '@/lib/i18n/pages/report-issue-public-content';

const ICONS = {
  zap: Zap,
  alertTriangle: AlertTriangle,
  bug: Bug,
  info: Info,
} as const;

function SuccessScreen({ email }: { email: string }) {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getReportIssuePublicContent(locale);
  return (
    <PublicPageShell title={t('reportIssue.sentTitle')} subtitle={t('reportIssue.sentSubtitle')}>
      <div className="max-w-lg mx-auto text-center py-8">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-3">{c.successTitle}</h2>
        <p className="text-gray-400 leading-relaxed mb-8">
          {c.successBodyBefore}
          <strong className="text-white">{email}</strong>
          {c.successBodyAfter}
        </p>
        <p className="text-xs text-gray-500">{c.successCriticalNote}</p>
      </div>
    </PublicPageShell>
  );
}

export default function ReportIssuePage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getReportIssuePublicContent(locale);

  const [bugType, setBugType] = useState('');
  const [priority, setPriority] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugType || !priority) {
      toast.error(t('reportIssue.toastSelectType'));
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugType, priority, title, description, steps, email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('reportIssue.toastSendError'));
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error(t('reportIssue.toastNetwork'));
    } finally {
      setSending(false);
    }
  };

  if (submitted) return <SuccessScreen email={email} />;

  return (
    <PublicPageShell title={t('reportIssue.formTitle')} subtitle={t('reportIssue.formSubtitle')}>
      <div className="max-w-2xl mx-auto">
        {/* SLA banner */}
        <div className="flex items-center gap-3 rounded-xl border border-[#2563eb]/30 bg-[#2563eb]/10 px-4 py-3 mb-8">
          <Zap className="w-4 h-4 text-[#2563eb] shrink-0" />
          <p className="text-sm text-gray-300">
            <strong className="text-white">{c.slaBannerStrong}</strong>
            {c.slaBannerRest}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Bug type */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              {c.labelIssueType} <span className="text-red-400">*</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.bugTypes.map(({ id, iconKey, label, description }) => {
                const Icon = ICONS[iconKey];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBugType(id)}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all ${
                      bugType === id
                        ? 'border-[#2563eb] bg-[#2563eb]/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${bugType === id ? 'text-[#2563eb]' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${bugType === id ? 'text-[#2563eb]' : 'text-white'}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-500">{description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              {c.labelPriority} <span className="text-red-400">*</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.priorities.map(({ id, label, description, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPriority(id)}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                    priority === id
                      ? 'border-[#2563eb] bg-[#2563eb]/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      priority === id
                        ? 'bg-[#2563eb]'
                        : color.includes('red')
                          ? 'bg-red-500'
                          : color.includes('orange')
                            ? 'bg-orange-500'
                            : color.includes('amber')
                              ? 'bg-amber-500'
                              : 'bg-gray-500'
                    }`}
                  />
                  <div>
                    <p className={`text-sm font-medium ${priority === id ? 'text-[#2563eb]' : 'text-white'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-500">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="issue-title" className="block text-sm font-semibold text-white mb-2">
              {c.labelTitle} <span className="text-red-400">*</span>
            </label>
            <input
              id="issue-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={c.placeholderTitle}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="issue-desc" className="block text-sm font-semibold text-white mb-2">
              {c.labelDescription} <span className="text-red-400">*</span>
            </label>
            <textarea
              id="issue-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder={c.placeholderDescription}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] transition-colors resize-none"
            />
          </div>

          {/* Steps */}
          <div>
            <label htmlFor="issue-steps" className="block text-sm font-semibold text-white mb-2">
              {c.labelSteps}
            </label>
            <textarea
              id="issue-steps"
              rows={3}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={c.placeholderSteps}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] transition-colors resize-none"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="issue-email" className="block text-sm font-semibold text-white mb-2">
              {c.labelEmail} <span className="text-red-400">*</span>
            </label>
            <input
              id="issue-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={c.placeholderEmail}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98]"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {c.submitSending}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> {c.submitIdle}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">{c.footerNote}</p>
      </div>
    </PublicPageShell>
  );
}
