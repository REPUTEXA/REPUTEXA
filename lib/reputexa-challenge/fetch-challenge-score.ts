import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreReviewsForChallenge, isChallengePeriodActive, type ReviewScoreDetail } from '@/lib/reputexa-challenge/score-reviews';

export type CampaignRow = {
  id: string;
  user_id: string;
  title: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  competition_message: string;
  reward_description: string;
  bonus_keywords: string[] | null;
  tracked_employee_names: string[] | null;
  updated_at: string;
  team_share_token?: string;
};

export type EnrichedReviewScoreDetail = ReviewScoreDetail & {
  reviewCreatedAt: string | null;
  reviewerDisplayName: string | null;
  commentPreview: string | null;
};

export type EmployeeReviewHighlight = {
  reviewId: string;
  rating: number;
  delta: number;
  commentPreview: string | null;
  reviewCreatedAt: string | null;
  reviewerDisplayName: string | null;
  reasons: string[];
};

export type ScorePayload = {
  totalPoints: number;
  leaderboard: { name: string; points: number }[];
  details: EnrichedReviewScoreDetail[];
  reviewsByEmployee: Record<string, EmployeeReviewHighlight[]>;
};

function truncateComment(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** establishmentFilter: null = profil principal (establishment_id IS NULL), sinon UUID lieu. */
export async function fetchChallengeScoreForUser(
  supabase: SupabaseClient,
  userId: string,
  campaign: CampaignRow | null,
  establishmentFilter: string | null
): Promise<ScorePayload | null> {
  if (!campaign?.starts_at || !campaign.ends_at) return null;

  let revQuery = supabase
    .from('reviews')
    .select('id, rating, comment, reviewer_name, created_at')
    .eq('user_id', userId)
    .gte('created_at', campaign.starts_at)
    .lte('created_at', campaign.ends_at);

  if (establishmentFilter === null) {
    revQuery = revQuery.is('establishment_id', null);
  } else {
    revQuery = revQuery.eq('establishment_id', establishmentFilter);
  }

  const { data: reviews, error: revErr } = await revQuery.order('created_at', { ascending: false });
  if (revErr) {
    console.error('[fetch-challenge-score] reviews', revErr);
    return null;
  }

  const raw = reviews ?? [];
  const scored = scoreReviewsForChallenge(
    raw.map((r) => ({
      id: String(r.id),
      rating: Number(r.rating) || 0,
      comment: String(r.comment ?? ''),
      reviewer_name: String(r.reviewer_name ?? ''),
    })),
    campaign.tracked_employee_names ?? []
  );

  const byId = new Map(raw.map((r) => [String(r.id), r]));

  const details: EnrichedReviewScoreDetail[] = scored.details.map((d) => {
    const row = byId.get(d.reviewId);
    const comment = String(row?.comment ?? '');
    return {
      ...d,
      reviewCreatedAt: row?.created_at ? String(row.created_at) : null,
      reviewerDisplayName: row?.reviewer_name != null ? String(row.reviewer_name) : null,
      commentPreview: comment ? truncateComment(comment, 160) : null,
    };
  });

  const reviewsByEmployee: Record<string, EmployeeReviewHighlight[]> = {};
  for (const d of details) {
    for (const [name, delta] of Object.entries(d.employeeDeltas)) {
      if (!delta) continue;
      if (!reviewsByEmployee[name]) reviewsByEmployee[name] = [];
      reviewsByEmployee[name].push({
        reviewId: d.reviewId,
        rating: d.rating,
        delta,
        commentPreview: d.commentPreview,
        reviewCreatedAt: d.reviewCreatedAt,
        reviewerDisplayName: d.reviewerDisplayName,
        reasons: d.reasons,
      });
    }
  }
  for (const list of Object.values(reviewsByEmployee)) {
    list.sort((a, b) => {
      const ta = a.reviewCreatedAt ? new Date(a.reviewCreatedAt).getTime() : 0;
      const tb = b.reviewCreatedAt ? new Date(b.reviewCreatedAt).getTime() : 0;
      return tb - ta;
    });
  }

  return {
    totalPoints: scored.totalPoints,
    leaderboard: scored.leaderboard,
    details,
    reviewsByEmployee,
  };
}

export async function loadReputexaChallengeState(
  supabase: SupabaseClient,
  userId: string,
  establishmentParam: string
): Promise<{
  campaign: CampaignRow | null;
  periodActive: boolean;
  score: ScorePayload | null;
  establishmentFilter: string | null;
}> {
  const { data: campaign, error: campError } = await supabase
    .from('reputexa_challenge_campaigns')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (campError && campError.code !== 'PGRST116') {
    console.error('[reputexa-challenge] select campaign', campError);
  }

  const c = (campaign ?? null) as CampaignRow | null;
  const periodActive = c ? isChallengePeriodActive(c.is_active, c.starts_at, c.ends_at) : false;

  let establishmentFilter: string | null = null;
  if (establishmentParam && establishmentParam !== 'profile' && /^[0-9a-f-]{36}$/i.test(establishmentParam)) {
    establishmentFilter = establishmentParam;
  }

  const score = c ? await fetchChallengeScoreForUser(supabase, userId, c, establishmentFilter) : null;

  return { campaign: c, periodActive, score, establishmentFilter };
}
