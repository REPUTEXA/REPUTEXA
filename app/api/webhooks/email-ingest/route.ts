import { NextResponse } from 'next/server';
import { processBadReview } from '@/lib/whatsapp-alerts';
import type { GoogleReviewWebhookPayload } from '@/lib/whatsapp-alerts';

const BAD_REVIEW_THRESHOLD = 3;

/**
 * Webhook "email-ingest" pour TripAdvisor.
 *
 * Ce endpoint est pensé pour être appelé par un pipeline d'ingestion d'emails
 * (par ex. SendGrid Inbound, Postmark Inbound, Mailgun routes, etc.).
 *
 * L'email brut est parsé pour extraire :
 * - userId (identifiant Reputexa de l'établissement)
 * - reviewerName
 * - rating (1-5)
 * - comment
 *
 * Dans cette première version, on attend un format déjà pré-parsé,
 * mais on garde la porte ouverte pour un parsing de texte plus avancé.
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
      rawEmail,
    } = body as Partial<GoogleReviewWebhookPayload> & {
      rawEmail?: string;
    };

    // Si on a un "rawEmail" brut, on pourrait ici ajouter une logique de parsing
    // plus complexe (regex, LLM, etc.). Pour l'instant on suppose que
    // reviewerName, rating et comment sont déjà fournis.

    const finalReviewerName = (reviewerName ?? '').trim();
    const finalComment = (comment ?? '').trim();
    const ratingNum = Number(rating);

    if (!userId || !finalReviewerName || !finalComment || !rating) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: userId, reviewerName, rating, comment',
        },
        { status: 400 },
      );
    }

    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: 'rating must be 1-5' },
        { status: 400 },
      );
    }

    const payload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: finalReviewerName,
      rating: ratingNum,
      comment: finalComment,
      source: 'tripadvisor',
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
    console.error('[webhooks/email-ingest]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 },
    );
  }
}

