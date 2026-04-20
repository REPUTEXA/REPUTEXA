import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchChallengeScoreForUser, type CampaignRow } from '@/lib/reputexa-challenge/fetch-challenge-score';
import { isChallengePeriodActive } from '@/lib/reputexa-challenge/score-reviews';
import { canAccessReputexaChallenge } from '@/lib/reputexa-challenge/subscription-access';
import { checkReputexaTeamBoardRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  if (!checkReputexaTeamBoardRateLimit(request).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { token } = await context.params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const { data: c, error } = await admin
    .from('reputexa_challenge_campaigns')
    .select('*')
    .eq('team_share_token', token)
    .maybeSingle();

  if (error || !c) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const campaign = c as CampaignRow;

  const { data: profile } = await admin
    .from('profiles')
    .select('establishment_name, full_name, subscription_plan')
    .eq('id', campaign.user_id)
    .maybeSingle();

  if (!canAccessReputexaChallenge(profile?.subscription_plan)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const establishmentName =
    profile?.establishment_name?.trim() || profile?.full_name?.trim() || '';

  const periodActive = isChallengePeriodActive(campaign.is_active, campaign.starts_at, campaign.ends_at);
  const score = await fetchChallengeScoreForUser(admin, campaign.user_id, campaign, null);

  return NextResponse.json({
    title: campaign.title,
    establishmentName,
    startsAt: campaign.starts_at,
    endsAt: campaign.ends_at,
    periodActive,
    totalPoints: score?.totalPoints ?? 0,
    leaderboard: score?.leaderboard ?? [],
  });
}
