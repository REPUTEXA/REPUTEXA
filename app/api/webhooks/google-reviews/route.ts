import { NextResponse } from 'next/server';
import { processBadReview } from '@/lib/whatsapp-alerts';
import type { GoogleReviewWebhookPayload } from '@/lib/whatsapp-alerts';

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
    const body = await request.json().catch(() => ({}));
    const payload = body as Partial<GoogleReviewWebhookPayload>;

    const { userId, reviewerName, rating, comment } = payload;

    if (!userId || !reviewerName?.trim() || rating == null || !comment?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, reviewerName, rating, comment' },
        { status: 400 }
      );
    }

    const ratingNum = Number(rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: 'rating must be 1-5' },
        { status: 400 }
      );
    }

    const fullPayload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: reviewerName.trim(),
      rating: ratingNum,
      comment: comment.trim(),
      source: payload.source ?? 'google',
      placeId: payload.placeId,
      reviewId: payload.reviewId,
    };

    if (ratingNum < BAD_REVIEW_THRESHOLD) {
      const result = await processBadReview(fullPayload);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error ?? 'processBadReview failed' },
          { status: 500 }
        );
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
      reason: `rating >= ${BAD_REVIEW_THRESHOLD}`,
    });
  } catch (error) {
    console.error('[webhooks/google-reviews]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 }
    );
  }
}
