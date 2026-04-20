import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { produceAutomatedReviewReply } from '@/lib/ai/review-reply-brain';
import { detectLanguage, hasAiConfigured } from '@/lib/ai-service';
import { toPlanSlug } from '@/lib/feature-gate';
import { nextOpeningPatternIndex } from '@/lib/reviews/opening-pattern';
import { countOmniPriorReviewerMemories } from '@/lib/omni-synapse';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!hasAiConfigured()) {
      return apiJsonError(request, 'errors.shield_aiKeysMissing', 500);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const [reviewRes, profileRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, comment, rating, response_text, reviewer_name, establishment_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select(
          'seo_keywords, subscription_plan, selected_plan, establishment_name, address, ai_tone, ai_length, ai_safe_mode, ai_custom_instructions, language, payment_status, payment_failed_at, subscription_status, phone, email, omni_recursive_prompt_addon'
        )
        .eq('id', user.id)
        .single(),
    ]);

    const { data: review } = reviewRes;
    const { data: profile } = profileRes;

    if (!review) {
      return apiJsonError(request, 'errors.reviewNotFound', 404);
    }
    if (review.response_text) {
      return apiJsonError(request, 'errors.reviewAlreadyResponded', 400);
    }

    if ((profile?.subscription_status as string | null) === 'canceled') {
      return apiJsonError(request, 'errors.generateOptions_subscriptionCanceled', 403);
    }

    if ((profile?.payment_status as string | null) === 'unpaid') {
      const failedAtRaw = profile?.payment_failed_at as string | null;
      if (failedAtRaw) {
        const failedAt = new Date(failedAtRaw);
        const now = new Date();
        const diffMs = now.getTime() - failedAt.getTime();
        const graceMs = 3 * 24 * 60 * 60 * 1000;
        if (diffMs > graceMs) {
          return apiJsonError(request, 'errors.generateOptions_paymentOverdueGrace', 402);
        }
      }
      return apiJsonError(request, 'errors.generateOptions_paymentPending', 402);
    }

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    const seoKeywords = Array.isArray(profile?.seo_keywords)
      ? profile.seo_keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
      : [];
    const establishmentName = profile?.establishment_name?.trim() || 'client';
    const businessContext = [seoKeywords[0], profile?.address?.trim()].filter(Boolean).join(' à ') || establishmentName;
    const profileLanguage = (profile?.language as string) ?? 'fr';

    const reviewEstId = (review as { establishment_id?: string | null }).establishment_id ?? null;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sinceIso = sixMonthsAgo.toISOString();

    let repeatVisit = false;
    const authorName = (review.reviewer_name ?? '').trim();
    if (authorName.length > 0) {
      let rvq = supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('reviewer_name', authorName)
        .neq('id', id)
        .gte('created_at', sinceIso);
      if (reviewEstId == null) {
        rvq = rvq.is('establishment_id', null);
      } else {
        rvq = rvq.eq('establishment_id', reviewEstId);
      }
      const { count: priorAuthorCount } = await rvq;
      repeatVisit = (priorAuthorCount ?? 0) > 0;
    }
    if (!repeatVisit && authorName.length > 0) {
      const adminOmni = createAdminClient();
      if (adminOmni) {
        const omniCount = await countOmniPriorReviewerMemories(adminOmni, {
          userId: user.id,
          establishmentId: reviewEstId,
          reviewerName: authorName,
          sinceIso,
        });
        repeatVisit = omniCount > 0;
      }
    }

    let lastPublishedReply: string | null = null;
    {
      let pq = supabase
        .from('reviews')
        .select('response_text, ai_response')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1);
      if (reviewEstId == null) {
        pq = pq.is('establishment_id', null);
      } else {
        pq = pq.eq('establishment_id', reviewEstId);
      }
      const { data: lastPub } = await pq.maybeSingle();
      if (lastPub) {
        lastPublishedReply =
          (typeof lastPub.response_text === 'string' && lastPub.response_text) ||
          (typeof lastPub.ai_response === 'string' && lastPub.ai_response) ||
          null;
      }
    }
    const openingPatternIdx = nextOpeningPatternIndex(
      String(review.comment ?? '').trim(),
      authorName || 'Client',
      lastPublishedReply
    );

    const text = await produceAutomatedReviewReply({
      planSlug,
      comment: review.comment,
      reviewerName: review.reviewer_name ?? 'Client',
      rating: review.rating,
      establishmentName,
      businessContext,
      seoKeywords,
      profileLanguage,
      aiTone: profile?.ai_tone as string | null,
      aiLength: profile?.ai_length as string | null,
      aiCustomInstructions: profile?.ai_custom_instructions as string | null,
      phone: profile?.phone as string | null,
      email: profile?.email as string | null,
      omniRecursivePromptAddon: profile?.omni_recursive_prompt_addon as string | null,
      repeatVisit,
      openingPatternIdx,
    });

    const detectedLanguage = await detectLanguage(text);

    return NextResponse.json({
      options: [text],
      detectedLanguage,
    });
  } catch (error) {
    console.error('[supabase/reviews/generate-options]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
