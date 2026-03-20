import { NextResponse } from 'next/server';
import { processBadReview } from '@/lib/whatsapp-alerts';
import type { GoogleReviewWebhookPayload, StandardReview } from '@/lib/whatsapp-alerts';

const BAD_REVIEW_THRESHOLD = 3;

/**
 * Webhook pour les avis Trustpilot.
 * Normalise le payload vers GoogleReviewWebhookPayload, stocke dans Supabase
 * et déclenche une alerte WhatsApp si la note est < BAD_REVIEW_THRESHOLD.
 */
export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        { error: 'Missing required fields: userId, reviewerName/tpUserName, rating, comment/tpComment' },
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

    const payload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: standard.author,
      rating: ratingNum,
      comment: standard.text,
      source: 'trustpilot',
      reviewId,
    };

    if (ratingNum < BAD_REVIEW_THRESHOLD) {
      const result = await processBadReview(payload);
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
    console.error('[webhooks/platforms/trustpilot]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 },
    );
  }
}

