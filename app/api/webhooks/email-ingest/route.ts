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
 * Webhook "email-ingest" — ingestion d'avis via email (pipeline générique).
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
    const locale = apiLocaleFromRequest(request);
    const t = createServerTranslator('Api', locale);

    const body = await request.json().catch(() => ({}));

    const {
      userId,
      reviewerName,
      rating,
      comment,
      reviewId,
      rawEmail: _rawEmail,
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
      return apiJsonError(request, 'errors.invalidRatingPayload', 400);
    }

    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return apiJsonError(request, 'errors.ratingRange', 400);
    }

    const payload: GoogleReviewWebhookPayload = {
      userId,
      reviewerName: finalReviewerName,
      rating: ratingNum,
      comment: finalComment,
      source: 'google',
      reviewId,
    };

    safeIngestPlatformReviewWebhook(createAdminClient(), {
      userId: payload.userId,
      rating: ratingNum,
      comment: payload.comment,
      reviewId: reviewId ?? null,
      source: 'email_ingest',
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
    console.error('[webhooks/email-ingest]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
