'use client';

import { useCallback, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Sparkles, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  defaultDisplayName: string;
  defaultRoleLine: string;
  defaultCountryLabel: string;
  defaultFlagEmoji: string;
  /** Appelé après enregistrement + copie + ouverture Google : masque la section définitivement côté parent. */
  onCompleted: () => void;
};

export function ReputexaReviewBoostCard({
  defaultDisplayName,
  defaultRoleLine,
  defaultCountryLabel,
  defaultFlagEmoji,
  onCompleted,
}: Props) {
  const t = useTranslations('Dashboard.reviewBoost');
  const locale = useLocale();
  const router = useRouter();

  const firstDraftRef = useRef<string | null>(null);
  const lastOptimizedRef = useRef<string | null>(null);
  const [text, setText] = useState('');
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [roleLine, setRoleLine] = useState(defaultRoleLine);
  const [countryLabel, setCountryLabel] = useState(defaultCountryLabel);
  const [flagEmoji, setFlagEmoji] = useState(defaultFlagEmoji);
  const [optimizing, setOptimizing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hidden, setHidden] = useState(false);

  const googleReviewUrl = process.env.NEXT_PUBLIC_REPUTEXA_GOOGLE_REVIEW_URL?.trim() ?? '';

  const runOptimize = useCallback(async () => {
    const draft = text.trim();
    if (draft.length < 8) {
      toast.error(t('toastTooShort'));
      return;
    }
    if (firstDraftRef.current === null) {
      firstDraftRef.current = draft;
    }
    setOptimizing(true);
    try {
      const res = await fetch('/api/reputexa-platform-review/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, uiLocale: locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { optimized?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('toastOptimizeError'));
        return;
      }
      if (data.optimized) {
        lastOptimizedRef.current = data.optimized;
        setText(data.optimized);
        toast.success(t('toastOptimized'));
      }
    } finally {
      setOptimizing(false);
    }
  }, [locale, t, text]);

  const runPublish = useCallback(async () => {
    const bodyPublic = text.trim();
    const original = (firstDraftRef.current ?? text).trim();
    if (original.length < 8 || bodyPublic.length < 8) {
      toast.error(t('toastTooShort'));
      return;
    }
    const dn = displayName.trim();
    if (dn.length < 2) {
      toast.error(t('toastNameRequired'));
      return;
    }

    setPublishing(true);
    try {
      const optimizedForDb = lastOptimizedRef.current?.trim() || undefined;
      const res = await fetch('/api/reputexa-platform-review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyOriginal: original,
          bodyOptimized: optimizedForDb,
          bodyPublic,
          displayName: dn,
          roleLine: roleLine.trim() || undefined,
          countryLabel: countryLabel.trim() || undefined,
          flagEmoji: flagEmoji.trim() || undefined,
          locale,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('toastPublishError'));
        return;
      }

      try {
        await navigator.clipboard.writeText(bodyPublic);
      } catch {
        toast.error(t('toastClipboardFail'));
      }

      if (googleReviewUrl) {
        window.open(googleReviewUrl, '_blank', 'noopener,noreferrer');
      }

      void import('canvas-confetti').then((mod) => {
        mod.default({
          particleCount: 72,
          spread: 68,
          origin: { y: 0.74 },
        });
      });

      toast.success(googleReviewUrl ? t('toastPublishDone') : t('toastPublishDoneNoTab'));
      setHidden(true);
      onCompleted();
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }, [
    countryLabel,
    displayName,
    flagEmoji,
    googleReviewUrl,
    locale,
    onCompleted,
    roleLine,
    router,
    t,
    text,
  ]);

  if (hidden) return null;

  return (
    <section
      className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/25 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/70 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-sky-950/25 p-5 sm:p-6 shadow-sm"
      aria-labelledby="reputexa-review-boost-title"
    >
      <div className="flex flex-col gap-4 max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
            <Copy className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="reputexa-review-boost-title"
              className="font-display text-lg font-semibold text-slate-900 dark:text-zinc-100"
            >
              {t('title')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1.5 leading-relaxed">{t('description')}</p>
          </div>
        </div>

        <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed pl-1">
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
        </ol>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">{t('labelReview')}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={t('placeholder')}
            className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm leading-relaxed resize-y min-h-[130px]"
          />
        </label>

        <div className="rounded-xl border border-slate-200/90 dark:border-zinc-700/80 bg-white/60 dark:bg-zinc-900/40 px-3 py-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
            {t('sectionMeta')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-zinc-300">{t('labelDisplayName')}</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                autoComplete="name"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-zinc-300">{t('labelCountry')}</span>
              <input
                value={countryLabel}
                onChange={(e) => setCountryLabel(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700 dark:text-zinc-300">{t('labelRole')}</span>
              <input
                value={roleLine}
                onChange={(e) => setRoleLine(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700 dark:text-zinc-300">{t('labelFlag')}</span>
              <input
                value={flagEmoji}
                onChange={(e) => setFlagEmoji(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm max-w-[6rem]"
                placeholder={t('flagPlaceholder')}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void runOptimize()}
            disabled={optimizing || publishing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {optimizing ? t('aiThinking') : t('btnOptimize')}
          </button>
          <button
            type="button"
            onClick={() => void runPublish()}
            disabled={publishing || optimizing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-60 shadow-sm"
          >
            {publishing ? (
              t('publishing')
            ) : (
              <>
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('btnPublish')}
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">{t('hintFooter')}</p>
      </div>
    </section>
  );
}
