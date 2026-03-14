import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';

/**
 * GET : récupère les weekly insights pour l'utilisateur connecté.
 * ?establishmentId=xxx filtre par établissement (profile | uuid).
 * establishment_id null = principal, correspond à establishmentId=profile.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan')
    .eq('id', user.id)
    .single();

  const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
  if (!hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP)) {
    return NextResponse.json({ insight: null, reports: [] });
  }

  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get('establishmentId')?.trim() || null;

  let query = supabase
    .from('weekly_insights')
    .select('id, week_start, establishment_name, establishment_id, avg_rating, total_reviews, top_section, watch_section, advice_section, full_report_json, trend_severity, created_at')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false });

  if (establishmentId === 'profile') {
    query = query.is('establishment_id', null);
  } else if (establishmentId && /^[0-9a-f-]{36}$/i.test(establishmentId)) {
    query = query.eq('establishment_id', establishmentId);
  }

  const { data: reports } = await query;
  const insight = reports?.[0] ?? null;
  return NextResponse.json({ insight, reports: reports ?? [] });
}
