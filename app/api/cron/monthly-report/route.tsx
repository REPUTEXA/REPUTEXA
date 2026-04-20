/**
 * Cron mensuel : 1er de chaque mois — Elite PDF (source unique build-elite-monthly-pdf) → stockage → email.
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPlanSlug, hasFeature, FEATURES } from '@/lib/feature-gate';
import { resend, canSendEmail } from '@/lib/resend';
import { getMonthlyReportEmailHtml } from '@/lib/emails/templates';
import { generateReportEmailCopy } from '@/lib/monthly-reports/generate-email-copy';
import { buildEliteMonthlyPdfBundle } from '@/lib/monthly-reports/build-elite-monthly-pdf';

const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const ta = apiAdminT();
    const auth = request.headers.get('authorization');
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: ta('supabaseAdminMissing') }, { status: 500 });
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const periodStart = new Date(year, month - 1, 1);

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

      let bundle;
      try {
        bundle = await buildEliteMonthlyPdfBundle({
          admin,
          userId: profile.id as string,
          establishmentName: profile.establishment_name as string | null,
          subscriptionPlan: profile.subscription_plan as string | null,
          selectedPlan: profile.selected_plan as string | null,
          locale,
          periodStart,
        });
      } catch (e) {
        console.error('[monthly-report] build PDF failed:', profile.id, e);
        continue;
      }

      const { data: existing } = await admin
        .from('monthly_reports')
        .select('id')
        .eq('user_id', profile.id)
        .eq('month', bundle.month)
        .eq('year', bundle.year)
        .maybeSingle();

      if (!existing?.id) {
        const { error: insErr } = await admin.from('monthly_reports').insert({
          user_id: profile.id,
          month: bundle.month,
          year: bundle.year,
          report_type: bundle.reportType,
          summary_stats: bundle.summaryStats,
        });
        if (insErr) {
          console.error('[monthly-report] Insert failed:', insErr);
          continue;
        }
      } else {
        await admin
          .from('monthly_reports')
          .update({
            report_type: bundle.reportType,
            summary_stats: bundle.summaryStats,
          })
          .eq('user_id', profile.id)
          .eq('month', bundle.month)
          .eq('year', bundle.year);
      }

      await admin.storage
        .from('monthly-reports')
        .upload(bundle.pdfStoragePath, bundle.buffer as unknown as Blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      await admin
        .from('monthly_reports')
        .update({ pdf_url: bundle.pdfStoragePath })
        .eq('user_id', profile.id)
        .eq('month', bundle.month)
        .eq('year', bundle.year);

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
      const establishmentNeedingAttention = bundle.establishmentNeedingAttention;
      const dashboardUrl =
        establishmentNeedingAttention && establishmentNeedingAttention !== null
          ? `${baseUrl}/${locale}/dashboard/statistics?location=${encodeURIComponent(establishmentNeedingAttention)}`
          : `${baseUrl}/${locale}/dashboard/statistics`;

      if (resend && profile.email && canSendEmail()) {
        let subject = `Votre rapport mensuel REPUTEXA — ${bundle.monthLabel}`;
        let hook = `Bonjour, votre rapport ${bundle.monthLabel} est prêt.`;
        let teaser = `Consultez vos insights stratégiques et votre PDF en pièce jointe.`;

        if (bundle.totalReviews > 0) {
          try {
            const copy = await generateReportEmailCopy(
              {
                averageRating: bundle.averageRating,
                totalReviews: bundle.totalReviews,
                establishmentName: profile.establishment_name ?? '',
                siteCount:
                  bundle.groupComparison.length > 0 ? bundle.groupComparison.length : undefined,
              },
              bundle.summaryStats,
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
          monthLabel: bundle.monthLabel,
          hook,
          teaser,
          dashboardUrl,
          groupComparison: bundle.groupComparison.length > 0 ? bundle.groupComparison : undefined,
        });

        await resend.emails.send({
          from: process.env.RESEND_FROM ?? 'REPUTEXA <reports@reputexa.fr>',
          to: profile.email as string,
          subject,
          html,
          attachments: [
            {
              filename: `reputexa-rapport-${bundle.year}-${String(bundle.month).padStart(2, '0')}.pdf`,
              content: bundle.buffer.toString('base64'),
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
    const ta = apiAdminT();
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }
}
