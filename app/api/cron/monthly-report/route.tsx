/**
 * Cron mensuel : 1er de chaque mois à 9h00
 * Collecte data → Analyse IA → Génération PDF → Stockage → Envoi email
 */

import React from 'react';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPlanSlug, hasFeature, FEATURES } from '@/lib/feature-gate';
import { resend, canSendEmail } from '@/lib/resend';
import { EliteReportTemplate } from '@/components/reports/elite-report-template';
import { pdf } from '@react-pdf/renderer';
import { getReportTranslations } from '@/lib/i18n-server';
import { getMonthlyReportEmailHtml } from '@/lib/emails/templates';
import { generateEliteReport } from '@/lib/monthly-reports/generate-elite-report';
import { generateReportEmailCopy } from '@/lib/monthly-reports/generate-email-copy';
import type { ReportType } from '@/lib/monthly-reports/types';
import type { SummaryStats } from '@/lib/monthly-reports/types';

const CRON_SECRET = process.env.CRON_SECRET;

const localeMap: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 });
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, establishment_name, subscription_plan, selected_plan, preferred_language')
      .neq('email', null);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processed = 0;

    for (const profile of profiles) {
      const planSlug = toPlanSlug(profile.subscription_plan ?? null, profile.selected_plan ?? null);
      if (!hasFeature(planSlug, FEATURES.REPORTING_PDF)) continue;

      const locale = (profile.preferred_language as string) ?? 'fr';
      const monthLabel = from.toLocaleDateString(localeMap[locale] ?? 'fr-FR', {
        month: 'long',
        year: 'numeric',
      });

      const prevFrom = new Date(year, month - 2, 1);
      const prevTo = new Date(year, month - 1, 1);

      const { data: reviews } = await admin
        .from('reviews')
        .select('rating, comment, source, created_at, establishment_id')
        .eq('user_id', profile.id)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString());

      const { data: prevReviews } = await admin
        .from('reviews')
        .select('rating')
        .eq('user_id', profile.id)
        .gte('created_at', prevFrom.toISOString())
        .lt('created_at', prevTo.toISOString());

      const prevList = prevReviews ?? [];
    const prevTotalReviews = prevList.length;
    const prevAverageRating =
      prevTotalReviews > 0
        ? prevList.reduce((sum, r) => sum + (r.rating ?? 0), 0) / prevTotalReviews
        : 0;

    const list = (reviews ?? []) as { rating?: number; comment?: string; source?: string; created_at?: string; establishment_id?: string | null }[];
    const totalReviews = list.length;
      const averageRating =
        totalReviews > 0
          ? list.reduce((sum, r) => sum + (r.rating ?? 0), 0) / totalReviews
          : 0;
      const positiveCount = list.filter((r) => (r.rating ?? 0) >= 4).length;
      const negativeCount = list.filter((r) => (r.rating ?? 0) <= 3).length;

      const platformMap = new Map<string, number>();
      list.forEach((r) => {
        const src = String(r.source ?? '').toLowerCase();
        let key = 'Autre';
        if (src.includes('google')) key = 'Google';
        else if (src.includes('trip') || src.includes('advisor')) key = 'Tripadvisor';
        else if (src.includes('yelp')) key = 'Yelp';
        platformMap.set(key, (platformMap.get(key) ?? 0) + 1);
      });
      const platforms = Array.from(platformMap.entries()).map(([name, count]) => ({
        name,
        count,
      }));

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
        const { data: establishments } = await admin
          .from('establishments')
          .select('id, name')
          .eq('user_id', profile.id);
        const estMap = new Map<string, string>(
          (establishments ?? []).map((e) => [e.id, e.name || 'Sans nom'])
        );
        const principalName = profile.establishment_name ?? 'Principal';
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
        groupComparison.length > 0
          ? [...groupComparison].sort((a, b) => a.avgRating - b.avgRating)[0]?.id
          : null;

      const stats = {
        averageRating,
        totalReviews,
        positiveCount,
        negativeCount,
        platforms,
        monthLabel,
        establishmentName: profile.establishment_name ?? 'Mon établissement',
      };

      const reviewsForReport = list.map((r) => ({
        rating: r.rating ?? 0,
        comment: String(r.comment ?? ''),
        source: String(r.source ?? 'Unknown'),
        createdAt: String(r.created_at ?? ''),
      }));

      const reportType: ReportType =
        planSlug === 'zenith' ? 'ZENITH' : planSlug === 'pulse' ? 'PULSE' : 'VISION';

      let summaryStats: SummaryStats = {
        kpis: [],
        strength: totalReviews > 0 ? 'Analyse en cours.' : 'Pas assez de données ce mois-ci.',
        opportunity: totalReviews > 0 ? 'Consultez le rapport complet.' : 'Attendez le prochain mois.',
      };

      if (totalReviews > 0) {
        try {
          summaryStats = await generateEliteReport(stats, reviewsForReport, reportType, locale);
        } catch (e) {
          console.warn('[monthly-report] Elite report IA failed:', e);
        }
      }

      const { data: existing } = await admin
        .from('monthly_reports')
        .select('id')
        .eq('user_id', profile.id)
        .eq('month', from.getMonth() + 1)
        .eq('year', from.getFullYear())
        .maybeSingle();

      const reportId = existing?.id;

      if (!reportId) {
        const { data: inserted, error: insErr } = await admin
          .from('monthly_reports')
          .insert({
            user_id: profile.id,
            month: from.getMonth() + 1,
            year: from.getFullYear(),
            report_type: reportType,
            summary_stats: summaryStats,
          })
          .select('id')
          .single();

        if (insErr || !inserted?.id) {
          console.error('[monthly-report] Insert failed:', insErr);
          continue;
        }
      }

      const reportT = await getReportTranslations(locale);
      const doc = (
        <EliteReportTemplate
          establishmentName={profile.establishment_name ?? reportT.myEstablishment}
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
        />
      );
      const buffer = await pdf(doc).toBuffer();

      const path = `${profile.id}/${year}-${String(from.getMonth() + 1).padStart(2, '0')}.pdf`;
      await admin.storage
        .from('monthly-reports')
        .upload(path, buffer as unknown as Blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      await admin
        .from('monthly_reports')
        .update({ pdf_url: path })
        .eq('user_id', profile.id)
        .eq('month', from.getMonth() + 1)
        .eq('year', from.getFullYear());

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
      const dashboardUrl =
        establishmentNeedingAttention
          ? `${baseUrl}/${locale}/dashboard/statistics?location=${encodeURIComponent(establishmentNeedingAttention)}`
          : `${baseUrl}/${locale}/dashboard/statistics`;

      if (resend && profile.email && canSendEmail()) {
        let subject = `Votre rapport mensuel REPUTEXA — ${monthLabel}`;
        let hook = `Bonjour, votre rapport ${monthLabel} est prêt.`;
        let teaser = `Consultez vos insights stratégiques et votre PDF en pièce jointe.`;

        if (totalReviews > 0) {
          try {
            const copy = await generateReportEmailCopy(
              {
                averageRating,
                totalReviews,
                establishmentName: profile.establishment_name ?? '',
              },
              summaryStats,
              locale
            );
            subject = copy.subject;
            hook = copy.hook;
            teaser = copy.teaser;
          } catch (e) {
            console.warn('[monthly-report] Email copy IA failed:', e);
          }
        }

        const html = getMonthlyReportEmailHtml({
          establishmentName: profile.establishment_name ?? '',
          monthLabel,
          hook,
          teaser,
          dashboardUrl,
          groupComparison: groupComparison.length > 0 ? groupComparison : undefined,
        });

        await resend.emails.send({
          from: process.env.RESEND_FROM ?? 'REPUTEXA <reports@reputexa.fr>',
          to: profile.email,
          subject,
          html,
          attachments: [
            {
              filename: `reputexa-rapport-${year}-${String(from.getMonth() + 1).padStart(2, '0')}.pdf`,
              content: Buffer.from(buffer as unknown as Uint8Array).toString('base64'),
              contentType: 'application/pdf',
            },
          ],
        });
      }

      processed += 1;
    }

    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    console.error('[cron/monthly-report]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 },
    );
  }
}
