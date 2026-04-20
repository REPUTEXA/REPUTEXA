import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { processBadReview } from '@/lib/whatsapp-alerts';
import type { GoogleReviewWebhookPayload } from '@/lib/whatsapp-alerts';
import { safeIngestPlatformReviewWebhook } from '@/lib/omni-synapse';

const BAD_REVIEW_THRESHOLD = 3;

/**
 * Webhook pour les nouveaux avis Google (ou autre source).
 *
 * Appelé par :
 * - Cron/sync qui récupère les avis Google et POST ici
 * - Google Cloud Function / Pub/Sub
 * - Test manuel
 *
 * Body: { userId, reviewerName, rating, comment, source?, placeId?, reviewId? }
 */
export async function POST(request: Request) {
  try {
    const t = createServerTranslator('Api', apiLocaleFromRequest(request));

    const body = await request.json().catch(() => ({}));
    const payload = body as Partial<GoogleReviewWebhookPayload>;

    const { userId, reviewerName, rating, comment } = payload;

    if (!userId || !reviewerName?.trim() || rating == null || !comment?.trim()) {
      return apiJsonError(request, 'errors.invalidRatingPayload', 400);
    }

    const ratingNum = Number(rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return apiJsonError(request, 'errors.ratingRange', 400);
    }

    const fullPayload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: reviewerName.trim(),
      rating: ratingNum,
      comment: comment.trim(),
      source: payload.source ?? 'google',
      placeId: payload.placeId,
      reviewId: payload.reviewId,
      establishmentId: payload.establishmentId ?? null,
    };

    safeIngestPlatformReviewWebhook(createAdminClient(), {
      userId: fullPayload.userId,
      rating: ratingNum,
      comment: fullPayload.comment,
      reviewId: fullPayload.reviewId ?? null,
      source: fullPayload.source ?? 'google',
      reviewerName: fullPayload.reviewerName,
      establishmentId: fullPayload.establishmentId ?? null,
    });

    if (ratingNum < BAD_REVIEW_THRESHOLD) {
      const result = await processBadReview(fullPayload);
      if (!result.success) {
        return apiJsonError(request, 'serverError', 500);
      }
      return NextResponse.json({
        action: 'bad_review',
        processed: true,
        reviewId: result.reviewId,
        suggestedReply: result.suggestedReply,
        whatsappSent: result.whatsappSent,
      });
    }

    return NextResponse.json({
      action: 'ignored',
      processed: false,
      reason: t('errors.emailIngest_ignoredRatingGte', { threshold: BAD_REVIEW_THRESHOLD }),
    });
  } catch (error) {
    console.error('[webhooks/google-reviews]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
