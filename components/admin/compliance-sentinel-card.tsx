'use client';

import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ChevronRight, FileWarning, Radar, ShieldCheck } from 'lucide-react';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';

export type ComplianceSentinelCardProps = {
  lastGuardianAt: string | null;
  guardianStatus: string;
  pendingDraftsCount: number;
  lastSummary: string | null;
};

type SentinelLabelKey =
  | 'scoreLabel_error'
  | 'scoreLabel_actionRecommended'
  | 'scoreLabel_watchSuggested'
  | 'scoreLabel_ok'
  | 'scoreLabel_pendingFirst';

function getConformityScore(
  status: string,
  pending: number
): { value: number; labelKey: SentinelLabelKey; dot: 'green' | 'amber' | 'red' } {
  if (status === 'error') return { value: 72, labelKey: 'scoreLabel_error', dot: 'red' };
  if (status === 'review_needed' || pending > 0) {
    return {
      value: pending > 0 ? Math.max(82, 96 - pending * 8) : 88,
      labelKey: pending > 0 ? 'scoreLabel_actionRecommended' : 'scoreLabel_watchSuggested',
      dot: 'amber',
    };
  }
  if (status === 'ok') return { value: 100, labelKey: 'scoreLabel_ok', dot: 'green' };
  return { value: 94, labelKey: 'scoreLabel_pendingFirst', dot: 'amber' };
}

function formatGuardianRel(
  iso: string | null,
  t: ReturnType<typeof useTranslations>,
  format: ReturnType<typeof useFormatter>
): string {
  if (!iso) return t('relNever');
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('relJustNow');
  if (m < 60) return t('relMinutes', { count: m });
  const h = Math.floor(m / 60);
  if (h < 48) return t('relHours', { count: h });
  return format.dateTime(d, { day: 'numeric', month: 'short' });
}

/**
 * « Agent de conformité » / veille — Legal Guardian + brouillons + guide intégré.
 */
export function ComplianceSentinelCard({
  lastGuardianAt,
  guardianStatus,
  pendingDraftsCount,
  lastSummary,
}: ComplianceSentinelCardProps) {
  const t = useTranslations('Admin.complianceSentinel');
  const format = useFormatter();
  const conf = getConformityScore(guardianStatus, pendingDraftsCount);
  const rel = formatGuardianRel(lastGuardianAt, t, format);

  const richIntro = {
    strong: (chunks: ReactNode) => (
      <strong className="text-zinc-400 font-semibold">{chunks}</strong>
    ),
  };
  const richBullet = {
    strong: (chunks: ReactNode) => (
      <strong className="text-zinc-300 font-semibold">{chunks}</strong>
    ),
  };
  const richGuide = {
    strong: (chunks: ReactNode) => (
      <strong className="text-zinc-300 font-semibold">{chunks}</strong>
    ),
  };
  const richEmail = {
    code: (chunks: ReactNode) => <code className="text-zinc-400">{chunks}</code>,
  };

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/25 to-zinc-950/40 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-0">
        <div className="flex-1 p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center shrink-0">
              <Radar className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-tight">{t('title')}</h2>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                {t.rich('introRich', richIntro)}
              </p>
            </div>
          </div>

          <ul className="space-y-2 text-[11px] text-zinc-400 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-cyan-500 shrink-0">{t('listBullet')}</span>
              <span>{t.rich('bulletPersonalDataRich', richBullet)}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-500 shrink-0">{t('listBullet')}</span>
              <span>{t.rich('bulletGoogleReviewsRich', richBullet)}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-500 shrink-0">{t('listBullet')}</span>
              <span>{t.rich('bulletTransparencyRich', richBullet)}</span>
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 font-semibold border ${
                conf.dot === 'green'
                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
                  : conf.dot === 'amber'
                    ? 'bg-amber-500/10 border-amber-500/35 text-amber-200'
                    : 'bg-red-500/10 border-red-500/35 text-red-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  conf.dot === 'green' ? 'bg-emerald-400' : conf.dot === 'amber' ? 'bg-amber-400' : 'bg-red-400'
                }`}
                aria-hidden
              />
              {t('statusPrefix')} {t(conf.labelKey)}
            </span>
            <span className="text-zinc-500">
              {t('lastWatchPrefix')}{' '}
              <span className="text-zinc-300">{rel}</span>
              {lastGuardianAt ? <span className="text-zinc-600"> {t('lastWatchTour')}</span> : null}
            </span>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/35 px-4 py-3 flex gap-3 items-start">
            {pendingDraftsCount > 0 ? (
              <FileWarning className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-200">
                {t('pendingDocsTitle')}{' '}
                <span className="tabular-nums">{t('pendingDocsLine', { count: pendingDraftsCount })}</span>
              </p>
              {lastSummary ? (
                <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed line-clamp-3">
                  {lastSummary}
                </p>
              ) : (
                <p className="text-[11px] text-zinc-500 mt-1.5">{t.rich('emailFallbackRich', richEmail)}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/dashboard/admin/compliance"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600/85 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5"
            >
              {t('ctaCompliance')}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/dashboard/admin#legal-publish"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 font-medium px-3 py-2"
            >
              {t('ctaPublishLegal')}
            </Link>
          </div>

          <AdminGuidePanel title={t('guideTitle')}>
            <div className="space-y-3">
              <section>
                <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                  {t('guideWhatTitle')}
                </h3>
                <p>{t.rich('guideWhatRich', richGuide)}</p>
              </section>
              <section>
                <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                  {t('guideColorTitle')}
                </h3>
                <p>{t.rich('guideColorRich', richGuide)}</p>
              </section>
              <section>
                <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                  {t('guideOrderTitle')}
                </h3>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>{t('guideOrderStep1')}</li>
                  <li>{t.rich('guideOrderStep2Rich', richGuide)}</li>
                  <li>{t.rich('guideOrderStep3Rich', richGuide)}</li>
                  <li>{t.rich('guideOrderStep4Rich', richGuide)}</li>
                </ol>
              </section>
              <section>
                <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                  {t('guideLinksTitle')}
                </h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>{t.rich('guideLinksItem1Rich', richGuide)}</li>
                  <li>{t.rich('guideLinksItem2Rich', richGuide)}</li>
                </ul>
              </section>
              <section>
                <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                  {t('guideMailsTitle')}
                </h3>
                <p>{t('guideMailsP')}</p>
              </section>
            </div>
          </AdminGuidePanel>
        </div>

        <div className="lg:w-[8.5rem] shrink-0 flex items-center justify-center p-5 lg:border-l border-cyan-500/15 bg-cyan-950/10">
          <div
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-3 py-4 min-w-[5.5rem] ${
              conf.value >= 90
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : conf.value >= 75
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-red-500/50 bg-red-500/10'
            }`}
          >
            <span className="text-3xl font-black tabular-nums text-white leading-none">{conf.value}</span>
            <span className="text-[10px] font-semibold text-zinc-400 tabular-nums leading-none tracking-wide">
              {t('scoreOutOf100')}
            </span>
            <span className="text-[9px] text-zinc-600 text-center leading-tight mt-0.5">{t('scoreIndexLabel')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
