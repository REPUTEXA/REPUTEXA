import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { processBadReview } from '@/lib/whatsapp-alerts';
import type { GoogleReviewWebhookPayload, StandardReview } from '@/lib/whatsapp-alerts';
import { safeIngestPlatformReviewWebhook } from '@/lib/omni-synapse';

const BAD_REVIEW_THRESHOLD = 3;

/**
 * Webhook pour les avis Google.
 * Wrapper fin au-dessus de /webhooks/google-reviews pour homogénéiser la structure
 * des plateformes dans /api/webhooks/platforms/*.
 */
export async function POST(request: Request) {
  try {
    const t = createServerTranslator('Api', apiLocaleFromRequest(request));

    const body = await request.json().catch(() => ({}));
    const incoming = body as Partial<GoogleReviewWebhookPayload>;

    const { userId, reviewerName, rating, comment, reviewId, placeId } = incoming;

    const standard: StandardReview = {
      author: (reviewerName ?? '').trim(),
      rating: Number(rating),
      text: (comment ?? '').trim(),
      platform: 'google',
      externalId: reviewId ?? placeId ?? null,
    };

    if (
      !userId ||
      !standard.author ||
      !standard.text ||
      Number.isNaN(standard.rating)
    ) {
      return apiJsonError(request, 'errors.invalidRatingPayload', 400);
    }

    const ratingNum = standard.rating;
    if (ratingNum < 1 || ratingNum > 5) {
      return apiJsonError(request, 'errors.ratingRange', 400);
    }

    const fullPayload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: standard.author,
      rating: ratingNum,
      comment: standard.text,
      source: 'google',
      placeId,
      reviewId,
      establishmentId: (incoming as { establishmentId?: string | null }).establishmentId ?? null,
    };

    safeIngestPlatformReviewWebhook(createAdminClient(), {
      userId: fullPayload.userId,
      rating: ratingNum,
      comment: fullPayload.comment,
      reviewId: reviewId ?? placeId ?? null,
      source: 'google',
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
    console.error('[webhooks/platforms/google]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
