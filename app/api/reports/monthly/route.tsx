import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';
import { buildEliteMonthlyPdfBundle } from '@/lib/monthly-reports/build-elite-monthly-pdf';
import { apiJsonError } from '@/lib/api/api-error-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Mois calendaire précédent (même règle que le cron du 1er). */
function previousMonthPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

/**
 * Téléchargement du rapport mensuel « Elite » (identique au PDF email / bucket).
 * 1) Sert le fichier depuis le storage s'il existe déjà
 * 2) Sinon génère à la volée (IA + template cabinet) et met en cache dans le bucket + monthly_reports
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serverConfiguration', 500);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'establishment_name, subscription_plan, selected_plan, preferred_language, language'
      )
      .eq('id', user.id)
      .single();

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    if (!hasFeature(planSlug, FEATURES.REPORTING_PDF)) {
      return apiJsonError(request, 'errors.monthly_eliteReportPlanRequired', 403);
    }

    const locale =
      request.nextUrl.searchParams.get('locale') ??
      request.cookies.get('NEXT_LOCALE')?.value ??
      (profile?.preferred_language as string) ??
      (profile?.language as string) ??
      'fr';

    const periodStart = previousMonthPeriodStart();
    const y = periodStart.getFullYear();
    const m = periodStart.getMonth() + 1;
    const path = `${user.id}/${y}-${String(m).padStart(2, '0')}.pdf`;

    const { data: existingFile, error: dlErr } = await admin.storage.from('monthly-reports').download(path);

    let buffer: Buffer;

    if (!dlErr && existingFile) {
      const ab = await existingFile.arrayBuffer();
      if (ab.byteLength > 0) {
        buffer = Buffer.from(ab);
      } else {
        buffer = await generateAndPersistReport({
          admin,
          userId: user.id,
          profile,
          locale,
          periodStart,
          path,
        });
      }
    } else {
      buffer = await generateAndPersistReport({
        admin,
        userId: user.id,
        profile,
        locale,
        periodStart,
        path,
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reputexa-monthly-report-${y}-${String(m).padStart(2, '0')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[reports/monthly]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}

async function generateAndPersistReport(params: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  locale: string;
  periodStart: Date;
  path: string;
}): Promise<Buffer> {
  const { admin, userId, profile, locale, periodStart, path } = params;

  const bundle = await buildEliteMonthlyPdfBundle({
    admin,
    userId,
    establishmentName: profile?.establishment_name ?? null,
    subscriptionPlan: profile?.subscription_plan ?? null,
    selectedPlan: profile?.selected_plan ?? null,
    locale,
    periodStart,
  });

  await admin.storage
    .from('monthly-reports')
    .upload(path, bundle.buffer as unknown as Blob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  const { data: row } = await admin
    .from('monthly_reports')
    .select('id')
    .eq('user_id', userId)
    .eq('month', bundle.month)
    .eq('year', bundle.year)
    .maybeSingle();

  if (row?.id) {
    await admin
      .from('monthly_reports')
      .update({
        summary_stats: bundle.summaryStats,
        report_type: bundle.reportType,
        pdf_url: path,
      })
      .eq('id', row.id);
  } else {
    await admin.from('monthly_reports').insert({
      user_id: userId,
      month: bundle.month,
      year: bundle.year,
      report_type: bundle.reportType,
      summary_stats: bundle.summaryStats,
      pdf_url: path,
    });
  }

  return bundle.buffer;
}
