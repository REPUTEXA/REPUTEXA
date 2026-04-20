import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchChallengeScoreForUser, type CampaignRow } from '@/lib/reputexa-challenge/fetch-challenge-score';
import { canAccessReputexaChallenge } from '@/lib/reputexa-challenge/subscription-access';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

export const dynamic = 'force-dynamic';

type Body = { establishmentId?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(request);
  const tDash = createServerTranslator('Dashboard', locale);
  const defaultTitle = tDash('defiReputexa.defaultCampaignTitle');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan')
    .eq('id', user.id)
    .maybeSingle();
  if (!canAccessReputexaChallenge(profile?.subscription_plan)) {
    return apiJsonError(request, 'errors.reputexaChallengeZenith', 403);
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const establishmentParam = body.establishmentId ?? 'profile';

  let establishmentFilter: string | null = null;
  if (
    establishmentParam &&
    establishmentParam !== 'profile' &&
    /^[0-9a-f-]{36}$/i.test(establishmentParam)
  ) {
    establishmentFilter = establishmentParam;
  }

  const { data: campaign, error: campErr } = await supabase
    .from('reputexa_challenge_campaigns')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (campErr && campErr.code !== 'PGRST116') {
    console.error('[reputexa-challenge/archive] campaign', campErr);
    return apiJsonError(request, 'serverError', 500);
  }

  const c = campaign as CampaignRow | null;
  if (!c?.starts_at || !c.ends_at) {
    return apiJsonError(request, 'errors.reputexaChallengeNoPeriod', 400);
  }

  const endMs = new Date(c.ends_at).getTime();
  if (Number.isNaN(endMs) || endMs > Date.now()) {
    return apiJsonError(request, 'errors.reputexaChallengeNotEnded', 400);
  }

  const score = await fetchChallengeScoreForUser(supabase, user.id, c, establishmentFilter);
  if (!score) {
    return apiJsonError(request, 'errors.reputexaChallengeScoreFailed', 500);
  }

  const { error: insErr } = await supabase.from('reputexa_challenge_archives').insert({
    user_id: user.id,
    establishment_id: establishmentFilter,
    title: c.title,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    competition_message: c.competition_message ?? '',
    reward_description: c.reward_description ?? '',
    bonus_keywords: c.bonus_keywords ?? [],
    tracked_employee_names: c.tracked_employee_names ?? [],
    team_points: score.totalPoints,
    score_leaderboard: score.leaderboard,
    score_details: score.details,
  });

  if (insErr) {
    console.error('[reputexa-challenge/archive] insert', insErr);
    return apiJsonError(request, 'serverError', 500);
  }

  const { error: upErr } = await supabase
    .from('reputexa_challenge_campaigns')
    .update({
      title: defaultTitle,
      is_active: false,
      starts_at: null,
      ends_at: null,
      competition_message: '',
      reward_description: '',
      bonus_keywords: [],
      tracked_employee_names: [],
    })
    .eq('user_id', user.id);

  if (upErr) {
    console.error('[reputexa-challenge/archive] reset campaign', upErr);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({ ok: true });
}
