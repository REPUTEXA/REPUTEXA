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
 * Webhook pour les avis Trustpilot.
 * Normalise le payload vers GoogleReviewWebhookPayload, stocke dans Supabase
 * et déclenche une alerte WhatsApp si la note est < BAD_REVIEW_THRESHOLD.
 */
export async function POST(request: Request) {
  try {
    const t = createServerTranslator('Api', apiLocaleFromRequest(request));

    const body = await request.json().catch(() => ({}));

    const {
      userId,
      reviewerName,
      rating,
      comment,
      reviewId,
    } = body as Partial<GoogleReviewWebhookPayload> & {
      tpUserName?: string;
      tpRating?: number;
      tpComment?: string;
    };

    type TpBody = { tpUserName?: string; tpRating?: number; tpComment?: string };
    const tp = body as TpBody;
    const standard: StandardReview = {
      author: (reviewerName ?? tp.tpUserName ?? '').trim(),
      rating: Number(rating ?? tp.tpRating),
      text: (comment ?? tp.tpComment ?? '').trim(),
      platform: 'trustpilot',
      externalId: reviewId ?? null,
    };

    if (!userId || !standard.author || !standard.text || Number.isNaN(standard.rating)) {
      return apiJsonError(request, 'errors.invalidRatingPayload', 400);
    }

    const ratingNum = standard.rating;
    if (ratingNum < 1 || ratingNum > 5) {
      return apiJsonError(request, 'errors.ratingRange', 400);
    }

    const payload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: standard.author,
      rating: ratingNum,
      comment: standard.text,
      source: 'trustpilot',
      reviewId,
    };

    safeIngestPlatformReviewWebhook(createAdminClient(), {
      userId: payload.userId,
      rating: ratingNum,
      comment: payload.comment,
      reviewId: reviewId ?? null,
      source: 'trustpilot',
      reviewerName: payload.reviewerName,
      establishmentId: (body as { establishmentId?: string | null }).establishmentId ?? null,
    });

    if (ratingNum < BAD_REVIEW_THRESHOLD) {
      const result = await processBadReview(payload);
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
    console.error('[webhooks/platforms/trustpilot]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
