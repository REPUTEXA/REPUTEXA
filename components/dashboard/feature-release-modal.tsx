'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { normalizeAttachments } from '@/lib/updates/normalize-attachments';
import { UpdateAttachmentsMedia } from '@/components/dashboard/updates-list';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

const FEATURE_RELEASE_MODAL_SPRING = { type: 'spring' as const, damping: 28, stiffness: 320 };

export type FeatureReleaseData = {
  id: string;
  title: string;
  content: string;
  /** JSON brut depuis la base */
  attachments: unknown;
  publishAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  release: FeatureReleaseData;
  locale: string;
};

function formatReleaseDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(siteLocaleToIntlDateTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FeatureReleaseModal({ open, onClose, release, locale }: Props) {
  const tf = useTranslations('Dashboard.featureRelease');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const attachments = normalizeAttachments(release.attachments);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  /** Fermeture « lue » : uniquement via « C’est parti ! » — POST OK puis refresh. */
  async function confirmSeen() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/profile/feature-release-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateId: release.id }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        console.error('[FeatureReleaseModal]', msg);
        toast.error(tf('toastSaveError'));
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="feature-release-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feature-release-title"
          className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="absolute inset-0 bg-zinc-950/55 dark:bg-black/60 backdrop-blur-xl pointer-events-none"
            aria-hidden
          />
          <motion.div
            initial={{ y: 56, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 36, opacity: 0, scale: 0.98 }}
            transition={FEATURE_RELEASE_MODAL_SPRING}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-[1.35rem] border border-white/25 dark:border-zinc-600/40 bg-white/80 dark:bg-zinc-900/85 shadow-2xl shadow-violet-950/25 ring-1 ring-white/15 dark:ring-white/5 backdrop-blur-md"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/8 dark:from-violet-500/15" />
            <div className="relative px-5 pt-5 pb-4 border-b border-slate-200/60 dark:border-zinc-700/60">
              <div className="min-w-0 space-y-2 pr-1">
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-200">
                  <Sparkles className="w-3 h-3" aria-hidden />
                  {tf('badgeNew')}
                </span>
                <h2 id="feature-release-title" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {release.title}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                  {tf('communiqueDate', { date: formatReleaseDate(release.publishAt, locale) })}
                </p>
              </div>
            </div>

            <div className="relative max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              {release.content?.trim() ? (
                <div className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {release.content}
                </div>
              ) : null}
              {attachments.length > 0 ? <UpdateAttachmentsMedia items={attachments} /> : null}
            </div>

            <div className="relative flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:items-center px-5 py-4 border-t border-slate-200/60 dark:border-zinc-700/60 bg-slate-50/50 dark:bg-zinc-950/40">
              <Link
                href="/dashboard/updates"
                className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-violet-600 dark:text-violet-300 hover:underline py-2"
              >
                {tf('linkAllUpdates')}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmSeen()}
                className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:brightness-110 shadow-lg shadow-violet-500/25 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? tf('ctaBusy') : tf('ctaGotIt')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
