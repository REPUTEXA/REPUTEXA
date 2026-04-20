import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { InvestorMetricsPayload } from '@/lib/admin/investor-metrics';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';

const BUCKET = 'admin-investor-reports';

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 }) };
  }
  return { user, admin } as const;
}

function buildSummary(metrics: InvestorMetricsPayload): Record<string, unknown> {
  const u = metrics.unitEconomics?.totals;
  return {
    schemaVersion: 1,
    generatedAt: metrics.generatedAt,
    totalCashEur: metrics.stripe.totalCashEur,
    mrrEur: metrics.stripe.mrrEur,
    arrImpliedEur: metrics.stripe.mrrEur * 12,
    activeSubscriptions: metrics.stripe.activeSubscriptions,
    burnMonthEur: metrics.burnOps.totalEurMonth,
    openaiEurMonth: metrics.burnOps.openaiEurMonth ?? null,
    resendEurMonth: metrics.burnOps.resendEurMonth ?? null,
    openaiError: metrics.burnOps.openaiError ?? null,
    contributionMarginPct: u?.contributionMarginPct ?? null,
    variableCostRatioPct: u?.variableCostRatioPct ?? null,
    contributionAfterVariableEur: u?.contributionAfterVariableEur ?? null,
    avgMrrPerSubEur: u?.avgMrrPerSubEur ?? null,
    unmatchedStripeSubs: u?.unmatchedStripeSubs ?? null,
    paidRevenueMonths: metrics.paidRevenueHistoryMeta?.monthsWithData ?? null,
    paidRevenueFirstMonth: metrics.paidRevenueHistoryMeta?.firstMonthKey ?? null,
    paidRevenueLastMonth: metrics.paidRevenueHistoryMeta?.lastMonthKey ?? null,
    nonAdminProfilesLoaded: metrics.nonAdminProfilesLoaded ?? null,
    planMixBrief:
      metrics.planMix?.map((p) => `${p.name}:${p.count}`).join('|') ?? null,
    logoChurnMonthlyPct: metrics.saasKpis?.logoChurnMonthlyPct ?? null,
    estimatedLtvEur: metrics.saasKpis?.estimatedLtvEur ?? null,
    cpaEur: metrics.saasKpis?.cpaEur ?? null,
    newMerchantProfilesLast30d: metrics.saasKpis?.newMerchantProfilesLast30d ?? null,
  };
}

/** GET — list archives (most recent first). */
export async function GET() {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;

  const { data, error } = await admin
    .from('admin_investor_report_archives')
    .select('id, created_at, created_by, file_name, metrics_generated_at, byte_size, content_sha256, summary')
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.error('[investor-report-archive GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archives: data ?? [] });
}

/** POST — multipart: file (PDF), metrics (JSON string). */
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { user, admin } = gate;
  const tApi = createServerTranslator('Api');

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: tApi('errors.formDataExpected') }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob) || file.size < 100) {
    return NextResponse.json({ error: tApi('errors.pdfMissingOrSmall') }, { status: 400 });
  }

  if (file.size > 18 * 1024 * 1024) {
    return NextResponse.json({ error: tApi('errors.pdfTooLarge18') }, { status: 400 });
  }

  const rawMetrics = form.get('metrics');
  if (typeof rawMetrics !== 'string') {
    return NextResponse.json({ error: tApi('errors.metricsJsonRequired') }, { status: 400 });
  }

  let metrics: InvestorMetricsPayload;
  try {
    metrics = JSON.parse(rawMetrics) as InvestorMetricsPayload;
    if (!metrics.generatedAt) throw new Error('invalid');
  } catch {
    return NextResponse.json({ error: tApi('errors.metricsJsonInvalid') }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const content_sha256 = createHash('sha256').update(buf).digest('hex');
  const idFrag = randomBytes(4).toString('hex');
  const path = `${user.id}/${Date.now()}-${idFrag}.pdf`;
  const iso = new Date().toISOString().slice(0, 10);
  const file_name = `REPUTEXA-Investor-Report-${iso}-${idFrag}.pdf`;

  const up = await admin.storage.from(BUCKET).upload(path, buf, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (up.error) {
    console.error('[investor-report-archive upload]', up.error);
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  const metricsGeneratedAt = new Date(metrics.generatedAt);
  const insertedAt = metricsGeneratedAt.getTime() ? metricsGeneratedAt.toISOString() : null;

  const { data: row, error: insErr } = await admin
    .from('admin_investor_report_archives')
    .insert({
      created_by: user.id,
      storage_path: path,
      file_name,
      metrics_generated_at: insertedAt,
      byte_size: buf.length,
      content_sha256,
      summary: buildSummary(metrics),
    })
    .select('id, created_at, file_name, byte_size, content_sha256, summary')
    .single();

  if (insErr) {
    console.error('[investor-report-archive insert]', insErr);
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ archive: row });
}
