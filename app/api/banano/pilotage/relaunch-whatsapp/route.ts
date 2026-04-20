import { NextResponse } from 'next/server';
import { format, startOfMonth } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import {
  attributionCentsFromDiscount,
  composeLostClientWhatsAppBody,
  formatReductionForMessage,
  mergeLostConfig,
  reductionPayloadForLog,
} from '@/lib/banano/banano-automation-defaults';
import { personalizeLoyaltyAutomationMiddle } from '@/lib/banano/generate-loyalty-whatsapp-narrative';

export const dynamic = 'force-dynamic';

const MAX_MANUAL_BATCH = 20;
const COOLDOWN_MS = 30 * 86400000;

async function bumpMonthlyStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  cents: number
) {
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const { data: existing } = await supabase
    .from('banano_loyalty_automation_monthly_stats')
    .select('attributed_revenue_cents, sends_count')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .maybeSingle();

  const rev =
    Number((existing as { attributed_revenue_cents?: number } | null)?.attributed_revenue_cents ?? 0) +
    cents;
  const sends =
    Number((existing as { sends_count?: number } | null)?.sends_count ?? 0) + 1;

  await supabase.from('banano_loyalty_automation_monthly_stats').upsert(
    {
      user_id: userId,
      month_start: monthStart,
      attributed_revenue_cents: rev,
      sends_count: sends,
    },
    { onConflict: 'user_id,month_start' }
  );
}

/**
 * POST : envoie la relance « client perdu » par WhatsApp à tous les fidèles
 * éligibles (même règles que le cron), hors période de cooldown 30 jours.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);
  const tCompose = createServerTranslator('Dashboard.bananoAutomationCompose', locale);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('establishment_name')
    .eq('id', user.id)
    .maybeSingle();
  const commerceName =
    ((profile as { establishment_name?: string } | null)?.establishment_name ?? '').trim() ||
    tCompose('establishment_fallback');

  const { data: ruleRow } = await supabase
    .from('banano_loyalty_automation_rules')
    .select('config')
    .eq('user_id', user.id)
    .eq('rule_type', 'lost_client')
    .maybeSingle();

  const cfg = mergeLostConfig(
    (ruleRow as { config?: Record<string, unknown> } | null)?.config ?? {}
  );

  const now = new Date();
  const cooldownIso = new Date(now.getTime() - COOLDOWN_MS).toISOString();

  const { data: members, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, phone_e164, first_name, display_name, last_visit_at, lifetime_visit_count')
    .eq('user_id', user.id);

  if (memErr || !members) {
    console.error('[pilotage/relaunch-whatsapp]', memErr?.message);
    return NextResponse.json({ error: tm('pilotageMembersReadFailed') }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skippedCooldown = 0;
  const errors: string[] = [];

  const reductionLabel = formatReductionForMessage(
    cfg.discount_kind,
    cfg.discount_percent,
    cfg.discount_fixed_cents,
    locale
  );
  const attrCents = attributionCentsFromDiscount(cfg.discount_kind, cfg.discount_fixed_cents);

  for (const mem of members) {
    if (sent >= MAX_MANUAL_BATCH) break;
    const m = mem as {
      id: string;
      phone_e164: string;
      first_name?: string;
      display_name?: string;
      last_visit_at: string | null;
      lifetime_visit_count: number | null;
    };
    const visits = Math.max(0, Math.floor(Number(m.lifetime_visit_count ?? 0)));
    if (visits < cfg.min_lifetime_visits) continue;
    if (!m.last_visit_at) continue;
    const last = new Date(m.last_visit_at).getTime();
    const days = Math.floor((now.getTime() - last) / 86400000);
    if (days < cfg.inactive_days) continue;

    const { data: recent } = await supabase
      .from('banano_loyalty_automation_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('member_id', m.id)
      .eq('rule_type', 'lost_client')
      .gte('created_at', cooldownIso)
      .limit(1);

    if (recent?.length) {
      skippedCooldown++;
      continue;
    }

    const prenom = (m.first_name || m.display_name || '').split(/\s+/)[0] ?? '';
    let middleLost = cfg.message_template;
    if (process.env.OPENAI_API_KEY) {
      middleLost = await personalizeLoyaltyAutomationMiddle({
        scenario: 'lost_client',
        commerceName,
        prenom,
        baseMiddle: cfg.message_template,
        lostDaysInactive: days,
        locale,
      });
    }
    const body = composeLostClientWhatsAppBody(
      { ...cfg, message_template: middleLost },
      prenom,
      commerceName,
      tCompose('fallback_offer_lost'),
      tCompose,
      locale
    );
    const res = await sendWhatsAppMessage(m.phone_e164, body);
    const status = res.success ? 'sent' : 'failed';
    if (!res.success) {
      failed++;
      if (errors.length < 5 && res.error) errors.push(res.error);
    }

    const { error: logErr } = await supabase.from('banano_loyalty_automation_log').insert({
      user_id: user.id,
      member_id: m.id,
      rule_type: 'lost_client',
      channel: 'whatsapp',
      status,
      payload: {
        error: res.error ?? null,
        messageId: res.messageId ?? null,
        message_body: body,
        reduction: reductionPayloadForLog(
          cfg.discount_kind,
          cfg.discount_percent,
          cfg.discount_fixed_cents,
          reductionLabel
        ),
        establishment: commerceName,
        source: 'pilotage_manual',
      },
      estimated_revenue_cents: res.success ? attrCents : 0,
    });

    if (logErr) {
      console.error('[pilotage/relaunch-whatsapp log]', logErr.message);
      failed++;
    }

    if (res.success && !logErr) {
      await bumpMonthlyStats(supabase, user.id, attrCents);
      sent++;
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    skippedCooldown,
    errors: errors.length ? errors : undefined,
  });
}
