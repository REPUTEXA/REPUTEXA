import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { runBananoPerformanceReportGeneration } from '@/lib/banano/pilotage/run-performance-report-generation';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Body = { year?: number; month?: number };

/** Mois calendaire précédent (rapport « clôturé » par défaut). */
function defaultPeriodStart(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() - 1, 1);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tm('serverConfigurationError') }, { status: 500 });
  }

  let body: Body = {};
  try {
    const t = await req.text();
    if (t.trim()) body = JSON.parse(t) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  let periodStart: Date;
  if (body.year != null && body.month != null) {
    const y = Math.floor(Number(body.year));
    const mo = Math.floor(Number(body.month));
    if (y < 2020 || y > 2100 || mo < 1 || mo > 12) {
      return NextResponse.json({ error: tm('pilotageReportYearMonthValuesInvalid') }, { status: 400 });
    }
    periodStart = new Date(y, mo - 1, 1);
  } else {
    periodStart = defaultPeriodStart();
  }

  const now = new Date();
  if (
    periodStart.getFullYear() > now.getFullYear() ||
    (periodStart.getFullYear() === now.getFullYear() && periodStart.getMonth() > now.getMonth())
  ) {
    return NextResponse.json({ error: tm('pilotageReportFutureMonthNotAllowed') }, { status: 400 });
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('establishment_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: tm('bootstrapProfileReadFailed') }, { status: 500 });
  }

  const establishmentName =
    ((profile as { establishment_name?: string } | null)?.establishment_name ?? '').trim();

  const result = await runBananoPerformanceReportGeneration(admin, user.id, periodStart, establishmentName);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    year: result.year,
    month: result.month,
    badge: result.badge,
  });
}
