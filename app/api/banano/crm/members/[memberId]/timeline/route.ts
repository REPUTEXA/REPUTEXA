import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { reviewMatchesMember } from '@/lib/banano/review-matches-member';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import type { LoyaltyEventRow } from '@/lib/banano/loyalty-timeline-labels';
import { buildTimelineItems } from '@/lib/banano/loyalty-timeline-build.server';
import {
  buildIaSuggestion,
  buildSentimentLine,
  computeLoyaltyBadge,
  extractPurchaseNotes,
  visitPercentile,
} from '@/lib/banano/crm-client-insights';
import { hashPhoneForConsentFromE164 } from '@/lib/consent-log';
import { normalizePhone } from '@/lib/zenith-capture/can-contact';
import {
  ZENITH_RESOLICITATION_COOLDOWN_DAYS,
  solicitationCooldownCutoffIso,
} from '@/lib/zenith-capture/policy';

type Ctx = { params: Promise<{ memberId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { memberId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  if (!memberId || typeof memberId !== 'string') {
    return apiJsonError(req, 'errors.crm_clientInvalid', 400);
  }

  const { data: member, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select('*')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memErr || !member) {
    return apiJsonError(req, 'errors.crm_clientNotFound', 404);
  }

  const mm = member as {
    display_name: string;
    first_name?: string | null;
    last_name?: string | null;
    last_visit_at?: string | null;
    lifetime_visit_count?: number;
    created_at?: string;
    birth_date?: string | null;
  };

  const { data: events, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select('id, event_type, delta_points, delta_stamps, note, created_at, staff_id, items_count')
    .eq('member_id', memberId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(250);

  if (evErr) {
    console.error('[banano/crm timeline events]', evErr.message);
    return apiJsonError(req, 'errors.crm_loyaltyHistoryError', 500);
  }

  const rawEv = events ?? [];
  const staffIds = [
    ...new Set(
      rawEv
        .map((e) => (e as { staff_id: string | null }).staff_id)
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
    ),
  ];
  const staffNameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: stRows, error: stErr } = await supabase
      .from('banano_terminal_staff')
      .select('id, display_name')
      .eq('user_id', user.id)
      .in('id', staffIds);
    if (!stErr) {
      for (const s of stRows ?? []) {
        staffNameById.set((s as { id: string }).id, (s as { display_name: string }).display_name);
      }
    }
  }

  const eventsEnriched = rawEv.map((e) => {
    const row = e as { staff_id: string | null };
    const sid = row.staff_id;
    return {
      ...row,
      staff_display_name: sid ? (staffNameById.get(sid) ?? null) : null,
    };
  });

  const { data: reviewsRaw, error: revErr } = await supabase
    .from('reviews')
    .select('id, reviewer_name, rating, created_at, source')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(400);

  if (revErr) {
    console.error('[banano/crm timeline reviews]', revErr.message);
    return apiJsonError(req, 'errors.crm_reviewsError', 500);
  }

  const reviewsMatched =
    reviewsRaw?.filter((r) =>
      reviewMatchesMember(
        { reviewer_name: (r as { reviewer_name: string }).reviewer_name },
        mm
      )
    ) ?? [];

  const reviewsSorted = [...reviewsMatched].sort(
    (a, b) =>
      new Date((b as { created_at: string }).created_at).getTime() -
      new Date((a as { created_at: string }).created_at).getTime()
  );

  const { data: cohort } = await supabase
    .from('banano_loyalty_members')
    .select('lifetime_visit_count')
    .eq('user_id', user.id);

  const visitCounts = (cohort ?? []).map((row) =>
    Math.max(0, Math.floor(Number((row as { lifetime_visit_count?: number }).lifetime_visit_count ?? 0)))
  );
  const myVisits = Math.max(0, Math.floor(Number(mm.lifetime_visit_count ?? 0)));
  const percentileScore = visitPercentile(myVisits, visitCounts);
  const badge = computeLoyaltyBadge(
    myVisits,
    percentileScore,
    mm.last_visit_at ?? null,
    mm.created_at ?? null
  );
  const purchaseNotes = extractPurchaseNotes(
    rawEv as Array<{ event_type: string; note: string | null }>
  );
  const suggestion = buildIaSuggestion(mm.first_name ?? mm.display_name ?? 'Client', purchaseNotes);
  const sentiment = buildSentimentLine(
    reviewsSorted.map((r) => ({
      rating: Number((r as { rating: number }).rating),
      created_at: (r as { created_at: string }).created_at,
    }))
  );

  const items = buildTimelineItems(
    eventsEnriched as unknown as LoyaltyEventRow[],
    reviewsMatched.map((r) => ({
      id: (r as { id: string }).id,
      rating: Number((r as { rating: number }).rating),
      created_at: (r as { created_at: string }).created_at,
      source: (r as { source?: string | null }).source ?? null,
    })),
    apiLocaleFromRequest(req)
  );

  const insightsBlock = {
    badge,
    suggestion,
    sentiment,
    visit_percentile: percentileScore,
  };

  const phoneE164 = String((member as { phone_e164?: string }).phone_e164 ?? '').trim();
  const normPhone = phoneE164 ? normalizePhone(phoneE164) : '';
  const phoneHash = phoneE164 ? hashPhoneForConsentFromE164(phoneE164) : '';

  const [{ data: consentRows }, { data: blHit }, { data: chHit }] = phoneHash
    ? await Promise.all([
        supabase
          .from('consent_logs')
          .select('id, created_at, consent_type, message_preview, review_queue_id, metadata')
          .eq('merchant_id', user.id)
          .eq('phone_hash', phoneHash)
          .order('created_at', { ascending: true })
          .limit(100),
        supabase.from('blacklist').select('phone').eq('user_id', user.id).eq('phone', normPhone).maybeSingle(),
        supabase
          .from('contact_history')
          .select('contacted_at')
          .eq('user_id', user.id)
          .eq('phone', normPhone)
          .order('contacted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const lastContactAt = (chHit as { contacted_at?: string } | null)?.contacted_at ?? null;
  const cutoff = new Date(solicitationCooldownCutoffIso());
  const lc = lastContactAt ? new Date(lastContactAt) : null;
  const inCooldown = Boolean(lc && lc >= cutoff);
  let cooldownEndsAt: string | null = null;
  if (lc && !Number.isNaN(lc.getTime())) {
    const end = new Date(lc.getTime());
    end.setUTCDate(end.getUTCDate() + ZENITH_RESOLICITATION_COOLDOWN_DAYS);
    cooldownEndsAt = end.toISOString();
  }

  const whatsappRgpd = {
    consent_logs: consentRows ?? [],
    blacklisted: Boolean(blHit),
    last_contact_at: lastContactAt,
    cooldown_days: ZENITH_RESOLICITATION_COOLDOWN_DAYS,
    in_cooldown: inCooldown,
    cooldown_ends_at: cooldownEndsAt,
  };

  return NextResponse.json({
    member: {
      id: member.id,
      display_name: member.display_name,
      first_name: mm.first_name ?? '',
      last_name: mm.last_name ?? '',
      phone_e164: member.phone_e164,
      points_balance: member.points_balance,
      stamps_balance: member.stamps_balance,
      last_visit_at: mm.last_visit_at ?? null,
      lifetime_visit_count: mm.lifetime_visit_count ?? 0,
      created_at: mm.created_at ?? null,
      birth_date: mm.birth_date ?? null,
    },
    items,
    insights: insightsBlock,
    whatsapp_rgpd: whatsappRgpd,
  });
}
