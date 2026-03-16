import { NextResponse } from 'next/server';
import { processBadReview } from '@/lib/whatsapp-alerts';
import type { GoogleReviewWebhookPayload, StandardReview } from '@/lib/whatsapp-alerts';

const BAD_REVIEW_THRESHOLD = 3;

/**
 * Webhook pour les avis Google.
 * Wrapper fin au-dessus de /webhooks/google-reviews pour homogénéiser la structure
 * des plateformes dans /api/webhooks/platforms/*.
 */
export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        { error: 'Missing required fields: userId, reviewerName, rating, comment' },
        { status: 400 },
      );
    }

    const ratingNum = standard.rating;
    if (ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: 'rating must be 1-5' },
        { status: 400 },
      );
    }

    const fullPayload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: standard.author,
      rating: ratingNum,
      comment: standard.text,
      source: 'google',
      placeId,
      reviewId,
    };

    if (ratingNum < BAD_REVIEW_THRESHOLD) {
      const result = await processBadReview(fullPayload);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error ?? 'processBadReview failed' },
          { status: 500 },
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
    console.error('[webhooks/platforms/google]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 },
    );
  }
}

