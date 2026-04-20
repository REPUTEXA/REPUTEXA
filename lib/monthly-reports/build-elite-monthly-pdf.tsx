/**
 * Construction du PDF mensuel « cabinet conseil » (Elite) — source unique pour cron + téléchargement à la demande.
 */
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { createTranslator } from 'next-intl';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EliteReportTemplate } from '@/components/reports/elite-report-template';
import { pdfPayloadIntegritySha256Hex } from '@/lib/pdf/sentinel-pdf-integrity';
import { getSentinelPdfFooterLines } from '@/lib/pdf/sentinel-react-pdf-footer';
import { getReportTranslations } from '@/lib/i18n-server';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { generateEliteReport } from '@/lib/monthly-reports/generate-elite-report';
import { toPlanSlug } from '@/lib/feature-gate';
import type { ReportType, MonthlyStats, ReviewForReport, SummaryStats } from '@/lib/monthly-reports/types';

const localeMap: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

export type EliteMonthlyBuildParams = {
  admin: SupabaseClient;
  userId: string;
  establishmentName: string | null;
  subscriptionPlan: string | null;
  selectedPlan: string | null;
  locale: string;
  /** Premier jour du mois rapporté (ex. 1er février si rapport de février) */
  periodStart: Date;
};

export type EliteMonthlyBuildResult = {
  buffer: Buffer;
  summaryStats: SummaryStats;
  reportType: ReportType;
  monthLabel: string;
  year: number;
  month: number;
  averageRating: number;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  platforms: { name: string; count: number }[];
  pdfStoragePath: string;
  groupComparison: { name: string; avgRating: number; totalReviews: number; id: string }[];
  prevAverageRating: number;
  prevTotalReviews: number;
  establishmentNeedingAttention: string | null;
};

export async function buildEliteMonthlyPdfBundle(params: EliteMonthlyBuildParams): Promise<EliteMonthlyBuildResult> {
  const { admin, userId, establishmentName, subscriptionPlan, selectedPlan, locale, periodStart } = params;

  const from = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const prevFrom = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  const prevTo = new Date(from.getFullYear(), from.getMonth(), 1);

  const { data: reviews } = await admin
    .from('reviews')
    .select('rating, comment, source, created_at, establishment_id')
    .eq('user_id', userId)
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString());

  const { data: prevReviews } = await admin
    .from('reviews')
    .select('rating')
    .eq('user_id', userId)
    .gte('created_at', prevFrom.toISOString())
    .lt('created_at', prevTo.toISOString());

  const prevList = prevReviews ?? [];
  const prevTotalReviews = prevList.length;
  const prevAverageRating =
    prevTotalReviews > 0 ? prevList.reduce((sum, r) => sum + (r.rating ?? 0), 0) / prevTotalReviews : 0;

  const list =
    (reviews ?? []) as {
      rating?: number;
      comment?: string;
      source?: string;
      created_at?: string;
      establishment_id?: string | null;
    }[];

  const totalReviews = list.length;
  const averageRating =
    totalReviews > 0 ? list.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews : 0;
  const positiveCount = list.filter((r) => (r.rating ?? 0) >= 4).length;
  const negativeCount = list.filter((r) => (r.rating ?? 0) <= 3).length;

  const platformMap = new Map<string, number>();
  list.forEach((r) => {
    const src = String(r.source ?? '').toLowerCase();
    let key = 'Autre';
    if (src.includes('google')) key = 'Google';
    else if (src.includes('facebook')) key = 'Facebook';
    else if (src.includes('trustpilot')) key = 'Trustpilot';
    platformMap.set(key, (platformMap.get(key) ?? 0) + 1);
  });
  const platforms = Array.from(platformMap.entries()).map(([name, count]) => ({ name, count }));

  const groupComparison: { name: string; avgRating: number; totalReviews: number; id: string }[] = [];
  const byEstId = new Map<string | null, { sum: number; count: number }>();
  for (const r of list) {
    const key = r.establishment_id ?? null;
    const cur = byEstId.get(key) ?? { sum: 0, count: 0 };
    cur.sum += r.rating ?? 0;
    cur.count += 1;
    byEstId.set(key, cur);
  }
  if (byEstId.size > 0) {
    const { data: establishments } = await admin.from('establishments').select('id, name').eq('user_id', userId);
    const estMap = new Map<string, string>(
      (establishments ?? []).map((e) => [e.id, e.name || 'Sans nom'])
    );
    const principalName = establishmentName ?? 'Principal';
    const principalData = byEstId.get(null);
    if (principalData && principalData.count > 0) {
      groupComparison.push({
        name: principalName,
        avgRating: principalData.sum / principalData.count,
        totalReviews: principalData.count,
        id: 'profile',
      });
    }
    for (const [eid, data] of Array.from(byEstId.entries())) {
      if (eid && data.count > 0) {
        groupComparison.push({
          name: estMap.get(eid) ?? eid.slice(0, 8),
          avgRating: data.sum / data.count,
          totalReviews: data.count,
          id: eid,
        });
      }
    }
  }

  const establishmentNeedingAttention =
    groupComparison.length > 0 ? [...groupComparison].sort((a, b) => a.avgRating - b.avgRating)[0]?.id ?? null : null;

  const monthLabel = from.toLocaleDateString(localeMap[locale] ?? 'fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  const multiEstablishmentBreakdown =
    groupComparison.length > 1
      ? groupComparison
          .map((g) => `- ${g.name}: note moyenne ${g.avgRating.toFixed(2)}/5, volume ${g.totalReviews} avis`)
          .join('\n')
      : '';

  const stats: MonthlyStats = {
    averageRating,
    totalReviews,
    positiveCount,
    negativeCount,
    platforms,
    monthLabel,
    establishmentName:
      groupComparison.length > 1
        ? `${establishmentName ?? 'Compte'} — agrégat ${groupComparison.length} sites`
        : establishmentName ?? 'Mon établissement',
  };

  const reviewsForReport: ReviewForReport[] = list.map((r) => ({
    rating: r.rating ?? 0,
    comment: String(r.comment ?? ''),
    source: String(r.source ?? 'Unknown'),
    createdAt: String(r.created_at ?? ''),
  }));

  const planSlug = toPlanSlug(subscriptionPlan, selectedPlan);
  const reportType: ReportType =
    planSlug === 'zenith' ? 'ZENITH' : planSlug === 'pulse' ? 'PULSE' : 'VISION';

  let summaryStats: SummaryStats = {
    kpis: [],
    strength: totalReviews > 0 ? 'Analyse en cours.' : 'Pas assez de données ce mois-ci.',
    opportunity: totalReviews > 0 ? 'Consultez le rapport complet.' : 'Attendez le prochain mois.',
  };

  const prevMonthLabel = prevFrom.toLocaleDateString(localeMap[locale] ?? 'fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  let weeklyContinuity: string | undefined;
  try {
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fromStr = ymd(from);
    const toStr = ymd(to);
    let { data: weeks } = await admin
      .from('weekly_insights')
      .select('week_start, establishment_id, establishment_name, top_section, watch_section, advice_section')
      .eq('user_id', userId)
      .gte('week_start', fromStr)
      .lt('week_start', toStr)
      .order('week_start', { ascending: false })
      .limit(24);
    if (!weeks?.length) {
      const fb = await admin
        .from('weekly_insights')
        .select('week_start, establishment_id, establishment_name, top_section, watch_section, advice_section')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(16);
      weeks = fb.data;
    }
    if (weeks?.length) {
      weeklyContinuity = weeks
        .map((w) => {
          const site =
            w.establishment_id == null
              ? 'Groupe'
              : String((w.establishment_name as string) || 'Site').slice(0, 48);
          const t = (w.top_section ?? '').slice(0, 120);
          const wa = (w.watch_section ?? '').slice(0, 120);
          const ad = (w.advice_section ?? '').slice(0, 120);
          return `- [${site}] ${w.week_start} · ${t}${t.length >= 120 ? '…' : ''} | ⚠ ${wa}${wa.length >= 120 ? '…' : ''} | ✓ ${ad}${ad.length >= 120 ? '…' : ''}`;
        })
        .join('\n');
    }
  } catch {
    weeklyContinuity = undefined;
  }

  if (totalReviews > 0) {
    try {
      summaryStats = await generateEliteReport(stats, reviewsForReport, reportType, locale, {
        previousMonth:
          prevTotalReviews > 0
            ? {
                monthLabel: prevMonthLabel,
                averageRating: prevAverageRating,
                totalReviews: prevTotalReviews,
              }
            : undefined,
        weeklyContinuity,
        multiEstablishmentBreakdown: multiEstablishmentBreakdown || undefined,
      });
    } catch (e) {
      console.warn('[build-elite-monthly-pdf] Elite report IA failed:', e);
    }
  }

  const reportT = await getReportTranslations(locale);
  const estName = establishmentName ?? reportT.myEstablishment;
  const generatedAt = new Date();
  const sha256Hex = await pdfPayloadIntegritySha256Hex({
    kind: 'elite-strategic-report',
    v: 1,
    establishmentName: estName,
    monthLabel,
    averageRating,
    totalReviews,
    positiveCount,
    negativeCount,
    platforms,
    summaryStats,
    previousMonthRating: prevTotalReviews > 0 ? prevAverageRating : undefined,
    previousMonthReviews: prevTotalReviews > 0 ? prevTotalReviews : undefined,
    groupComparison,
  });

  const sentinelFooter = getSentinelPdfFooterLines(locale, generatedAt, sha256Hex);

  const locNorm = normalizeAppLocale(locale);
  const eliteMessages = getServerMessagesForLocale(locNorm);
  const eliteT = createTranslator({ locale: locNorm, messages: eliteMessages, namespace: 'EliteMonthlyPdf' });

  const doc = (
    <EliteReportTemplate
      eliteT={eliteT}
      establishmentName={estName}
      monthLabel={monthLabel}
      averageRating={averageRating}
      totalReviews={totalReviews}
      positiveCount={positiveCount}
      negativeCount={negativeCount}
      platforms={platforms}
      summaryStats={summaryStats}
      previousMonthRating={prevTotalReviews > 0 ? prevAverageRating : undefined}
      previousMonthReviews={prevTotalReviews > 0 ? prevTotalReviews : undefined}
      groupComparison={groupComparison}
      sentinelFooter={sentinelFooter}
    />
  );

  const pdfBytes = await pdf(doc).toBuffer();
  const buffer = Buffer.from(pdfBytes as unknown as Uint8Array);

  const pdfStoragePath = `${userId}/${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}.pdf`;

  return {
    buffer,
    summaryStats,
    reportType,
    monthLabel,
    year: from.getFullYear(),
    month: from.getMonth() + 1,
    averageRating,
    totalReviews,
    positiveCount,
    negativeCount,
    platforms,
    pdfStoragePath,
    groupComparison,
    prevAverageRating,
    prevTotalReviews,
    establishmentNeedingAttention,
  };
}
