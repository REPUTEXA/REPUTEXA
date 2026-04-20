import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadReputexaChallengeState } from '@/lib/reputexa-challenge/fetch-challenge-score';
import { canAccessReputexaChallenge } from '@/lib/reputexa-challenge/subscription-access';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

export const dynamic = 'force-dynamic';

async function requireZenithForChallenge(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<NextResponse | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan')
    .eq('id', userId)
    .maybeSingle();
  if (!canAccessReputexaChallenge(profile?.subscription_plan)) {
    return apiJsonError(request, 'errors.reputexaChallengeZenith', 403);
  }
  return null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const gate = await requireZenithForChallenge(request, supabase, user.id);
  if (gate) return gate;

  const url = new URL(request.url);
  const establishmentId = url.searchParams.get('establishmentId') ?? 'profile';

  const state = await loadReputexaChallengeState(supabase, user.id, establishmentId);

  let archQuery = supabase
    .from('reputexa_challenge_archives')
    .select('*')
    .eq('user_id', user.id)
    .order('archived_at', { ascending: false })
    .limit(40);

  if (establishmentId === 'profile' || establishmentId === '' || establishmentId === null) {
    archQuery = archQuery.is('establishment_id', null);
  } else if (/^[0-9a-f-]{36}$/i.test(establishmentId)) {
    archQuery = archQuery.eq('establishment_id', establishmentId);
  }

  const { data: archives, error: archErr } = await archQuery;
  if (archErr) {
    console.error('[reputexa-challenge] archives', archErr);
  }

  return NextResponse.json({
    campaign: state.campaign,
    periodActive: state.periodActive,
    score: state.score,
    archives: (archives ?? []) as ReputexaArchiveRow[],
  });
}

export type ReputexaArchiveRow = {
  id: string;
  archived_at: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  competition_message: string;
  reward_description: string;
  bonus_keywords: string[] | null;
  tracked_employee_names: string[] | null;
  team_points: number;
  score_leaderboard: { name: string; points: number }[] | null;
  score_details: unknown[] | null;
};

type PutBody = {
  title?: string;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  competition_message?: string;
  reward_description?: string;
  tracked_employee_names?: string[];
};

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const gate = await requireZenithForChallenge(request, supabase, user.id);
  if (gate) return gate;

  const tDash = createServerTranslator('Dashboard', apiLocaleFromRequest(request));
  const defaultTitle = tDash('defiReputexa.defaultCampaignTitle');

  const body = (await request.json().catch(() => ({}))) as PutBody;

  const row = {
    user_id: user.id,
    title: (body.title ?? defaultTitle).trim() || defaultTitle,
    is_active: Boolean(body.is_active),
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    competition_message: (body.competition_message ?? '').trim(),
    reward_description: (body.reward_description ?? '').trim(),
    bonus_keywords: [] as string[],
    tracked_employee_names: Array.isArray(body.tracked_employee_names)
      ? body.tracked_employee_names.map((s) => String(s).trim()).filter(Boolean)
      : [],
  };

  const { data: existing } = await supabase
    .from('reputexa_challenge_campaigns')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('reputexa_challenge_campaigns')
      .update({
        title: row.title,
        is_active: row.is_active,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        competition_message: row.competition_message,
        reward_description: row.reward_description,
        bonus_keywords: row.bonus_keywords,
        tracked_employee_names: row.tracked_employee_names,
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[reputexa-challenge] update', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ campaign: data });
  }

  const { data, error } = await supabase.from('reputexa_challenge_campaigns').insert(row).select().single();

  if (error) {
    console.error('[reputexa-challenge] insert', error);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({ campaign: data });
}
