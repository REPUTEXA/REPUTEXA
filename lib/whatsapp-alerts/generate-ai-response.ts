import { HUMAN_FALLBACKS } from '@/lib/ai/concierge-prompts';
import { produceWhatsAppSuggestedReply } from '@/lib/ai/review-reply-brain';
import { hasAiConfigured } from '@/lib/ai-service';
import type { ReviewPlatform } from './types';

export interface GenerateAiResponseInput {
  comment: string;
  rating: number;
  establishmentName?: string;
  reviewerName?: string;
  platform?: ReviewPlatform;
}

/**
 * Génère une réponse IA suggérée pour un avis négatif (scripts / tests).
 * En production, le flux webhook utilise process-bad-review (même moteur).
 */
export async function generateSuggestedResponse(
  input: GenerateAiResponseInput
): Promise<string> {
  if (!hasAiConfigured()) {
    return HUMAN_FALLBACKS.negativeSorry;
  }

  try {
    const nom = input.establishmentName?.trim() || 'établissement';
    return await produceWhatsAppSuggestedReply({
      planSlug: 'pulse',
      comment: input.comment,
      reviewerName: input.reviewerName?.trim() || 'Client',
      rating: input.rating,
      establishmentName: nom,
      businessContext: nom,
      seoKeywords: [],
      profileLanguage: 'fr',
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[whatsapp-alerts] generateSuggestedResponse error:', error);
    }
    return HUMAN_FALLBACKS.negativeSorry;
  }
}
