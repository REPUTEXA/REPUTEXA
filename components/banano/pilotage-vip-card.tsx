'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { SmartCardItem } from '@/lib/banano/pilotage/types';

export function PilotageVipCard({
  card,
  heroDark = false,
  compact = false,
}: {
  card: SmartCardItem;
  /** Carte intégrée au bloc « Champions » (fond sombre). */
  heroDark?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations('Dashboard.whatsappReviewMeta');
  const pad = compact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5';
  return (
    <article
      className={
        heroDark
          ? `rounded-[12px] border border-violet-500/25 bg-black/40 ${pad} shadow-sm flex flex-col min-h-0 w-full min-w-0`
          : `rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] ${pad} shadow-sm flex flex-col min-h-0 w-full min-w-0`
      }
      title={t('pilotageVipArticleTitle')}
    >
      <div className="flex items-start gap-2.5 mb-2 min-w-0">
        <span className="text-xl shrink-0 leading-none pt-0.5" aria-hidden>
          {card.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h4
            className={
              heroDark
                ? 'text-sm font-bold text-zinc-50 leading-snug break-words'
                : 'text-sm font-bold text-slate-900 dark:text-slate-50 leading-snug break-words'
            }
          >
            {card.title}
          </h4>
          <p
            className={
              heroDark
                ? 'text-[10px] text-zinc-500 mt-1 leading-snug'
                : 'text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug'
            }
          >
            {t('pilotageVipRankingHint')}
          </p>
        </div>
      </div>
      <p
        className={
          heroDark
            ? `text-xs text-zinc-300 leading-relaxed flex-1 break-words ${compact ? 'line-clamp-3' : ''}`
            : `text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex-1 break-words ${compact ? 'line-clamp-3' : ''}`
        }
      >
        {card.body}
      </p>
      {compact ? (
        <Link
          href="/dashboard/whatsapp-review?tab=parametres"
          className={
            heroDark
              ? `mt-2 pt-2 block text-[11px] text-zinc-400 leading-snug border-t border-zinc-800 hover:text-sky-400`
              : `mt-2 pt-2 block text-[11px] text-slate-500 dark:text-slate-400 leading-snug border-t border-slate-100 dark:border-zinc-800 hover:text-[#2563eb]`
          }
        >
          {t('pilotageVipFooterCompact')}
        </Link>
      ) : (
        <p
          className={
            heroDark
              ? 'mt-3 text-[11px] text-zinc-500 leading-snug border-t border-zinc-800 pt-3'
              : 'mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-snug border-t border-slate-100 dark:border-zinc-800 pt-3'
          }
        >
          {t('pilotageVipFooterA')}
          <span
            className={heroDark ? 'font-semibold text-zinc-300' : 'font-semibold text-slate-600 dark:text-slate-300'}
          >
            {t('pilotageVipFooterStrong')}
          </span>
          {t('pilotageVipFooterB')}
          <Link
            href="/dashboard/whatsapp-review?tab=parametres"
            className={
              heroDark
                ? 'text-sky-400 font-semibold underline underline-offset-2'
                : 'text-[#2563eb] font-semibold underline underline-offset-2'
            }
          >
            {t('pilotageVipFooterLink')}
          </Link>
          {t('pilotageVipFooterC')}
        </p>
      )}
    </article>
  );
}
