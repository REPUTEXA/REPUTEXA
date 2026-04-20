import type { SupabaseClient } from '@supabase/supabase-js';
import { ingestInteractionMemory } from './perception';
import { normalizeReviewerKey } from './relational-memory';
import { registerPublicationFollowup } from './recursive-feedback';
import type { OmniIngestChannel } from './types';

/**
 * Ingestion best-effort : ne bloque jamais le flux métier principal.
 */
export function safeIngestInteractionMemory(
  admin: SupabaseClient,
  params: {
    userId: string;
    establishmentId?: string | null;
    channel: OmniIngestChannel;
    canonicalText: string;
    metadata?: Record<string, unknown>;
  }
): void {
  void ingestInteractionMemory({
    supabase: admin,
    userId: params.userId,
    establishmentId: params.establishmentId ?? null,
    channel: params.channel,
    canonicalText: params.canonicalText,
    metadata: params.metadata ?? {},
  }).catch((err) => {
    console.warn('[omni-synapse] ingestInteractionMemory:', err instanceof Error ? err.message : err);
  });
}

/** Planifie le contrôle J+48h (best-effort, non bloquant). */
export function safeScheduleOmniPublicationFollowup(
  admin: SupabaseClient,
  params: { userId: string; reviewQueueId: string; sentAt: Date }
): void {
  void registerPublicationFollowup({
    supabase: admin,
    userId: params.userId,
    reviewQueueId: params.reviewQueueId,
    sentAt: params.sentAt,
  }).catch((err) => {
    console.warn('[omni-synapse] registerPublicationFollowup:', err instanceof Error ? err.message : err);
  });
}

export function safeIngestPosQueueEvent(
  admin: SupabaseClient,
  params: {
    userId: string;
    reviewQueueId: string;
    firstName: string;
    lastPurchase: string | null;
    sourceInfo: string | null;
    ingress: string;
  }
): void {
  const parts = [
    `File collecte avis (${params.ingress})`,
    `client=${params.firstName}`,
    params.lastPurchase ? `achat=${params.lastPurchase}` : null,
    params.sourceInfo ? `source=${params.sourceInfo}` : null,
  ].filter(Boolean);
  safeIngestInteractionMemory(admin, {
    userId: params.userId,
    channel: 'addition',
    canonicalText: parts.join('. '),
    metadata: { review_queue_id: params.reviewQueueId, ingress: params.ingress },
  });
}

export function safeIngestWhatsAppOutbound(
  admin: SupabaseClient,
  params: {
    userId: string;
    reviewQueueId: string;
    firstName: string;
    commerceName: string;
    messageBody: string;
  }
): void {
  safeIngestInteractionMemory(admin, {
    userId: params.userId,
    channel: 'whatsapp',
    canonicalText:
      `Envoi sollicitation avis WhatsApp à ${params.firstName} pour ${params.commerceName}. ` +
      `Contenu: ${params.messageBody.slice(0, 2000)}`,
    metadata: { review_queue_id: params.reviewQueueId, kind: 'outbound_collection' },
  });
}

export function safeIngestGoogleReviewSignal(
  admin: SupabaseClient,
  params: {
    userId: string;
    rating: number;
    commentExcerpt: string;
    externalReviewId?: string | null;
    source?: string;
    reviewerName?: string | null;
    establishmentId?: string | null;
  }
): void {
  const author = (params.reviewerName ?? '').trim();
  const authorBit = author ? `Auteur : ${author}. ` : '';
  safeIngestInteractionMemory(admin, {
    userId: params.userId,
    establishmentId: params.establishmentId ?? null,
    channel: 'google',
    canonicalText:
      `${authorBit}Avis plateforme ${params.source ?? 'google'} ${params.rating}/5 : ${params.commentExcerpt.slice(0, 3500)}`,
    metadata: {
      external_review_id: params.externalReviewId ?? null,
      source: params.source ?? 'google',
      reviewer_name: author || null,
      reviewer_name_normalized: author ? normalizeReviewerKey(author) : null,
      establishment_id: params.establishmentId ?? null,
    },
  });
}

/** Webhooks plateforme (Google, Facebook, Trustpilot, email-ingest…) — une ligne, sans bloquer. */
export function safeIngestPlatformReviewWebhook(
  admin: SupabaseClient | null,
  params: {
    userId: string;
    rating: number;
    comment: string;
    reviewId?: string | null;
    source: string;
    reviewerName?: string | null;
    establishmentId?: string | null;
  }
): void {
  if (!admin) return;
  safeIngestGoogleReviewSignal(admin, {
    userId: params.userId,
    rating: params.rating,
    commentExcerpt: params.comment,
    externalReviewId: params.reviewId ?? null,
    source: params.source,
    reviewerName: params.reviewerName ?? null,
    establishmentId: params.establishmentId ?? null,
  });
}

export function safeIngestStripeBillingSignal(
  admin: SupabaseClient,
  params: {
    userId: string;
    eventType: string;
    planSlug: string;
    billingReason: string | null;
    amountPaid: number | null;
    currency: string | null;
  }
): void {
  const amount =
    params.amountPaid != null && params.currency
      ? `${(params.amountPaid / 100).toFixed(2)} ${params.currency.toUpperCase()}`
      : '—';
  safeIngestInteractionMemory(admin, {
    userId: params.userId,
    channel: 'stripe',
    canonicalText:
      `Stripe ${params.eventType}. Plan ${params.planSlug}. ` +
      `Motif facturation: ${params.billingReason ?? 'n/a'}. Montant: ${amount}.`,
    metadata: {
      stripe_event: params.eventType,
      billing_reason: params.billingReason,
    },
  });
}
