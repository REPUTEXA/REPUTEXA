import { createAdminClient } from '@/lib/supabase/admin';
import { produceWhatsAppSuggestedReply } from '@/lib/ai/review-reply-brain';
import { nextOpeningPatternIndex } from '@/lib/reviews/opening-pattern';
import { sendWhatsAppAlert } from './send-whatsapp-alert';
import { detectToxicity } from '@/lib/shield/detect-toxicity';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import type { GoogleReviewWebhookPayload, ReviewPlatform, StandardReview } from './types';

const PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  google: 'Google Business',
  facebook: 'Facebook',
  trustpilot: 'Trustpilot',
};

/**
 * Traite un avis négatif entrant via webhook :
 * 1. Analyse de toxicité IA (dual-engine Shield)
 * 2. Génère une réponse IA suggérée
 * 3. Insère dans `reviews` avec tous les champs toxicité
 * 4. Envoie l'alerte WhatsApp adaptée (Shield ou alerte classique)
 */
export async function processBadReview(
  payload: GoogleReviewWebhookPayload
): Promise<{
  success: boolean;
  reviewId?: string;
  suggestedReply?: string;
  whatsappSent?: boolean;
  isToxic?: boolean;
  error?: string;
}> {
  const { userId, reviewerName, rating, comment, source, reviewId } = payload;

  const platform: ReviewPlatform = source ?? 'google';
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  const standardReview: StandardReview = {
    author: reviewerName,
    rating,
    text: comment,
    platform,
    externalId: reviewId ?? null,
  };

  const supabase = createAdminClient();
  if (!supabase) {
    return { success: false, error: 'Supabase admin client not configured' };
  }

  // ── 1. Toxicity analysis (parallel with profile fetch for speed) ──
  const [toxicityResult, profileResult] = await Promise.all([
    detectToxicity(standardReview.text, platformLabel),
    supabase
      .from('profiles')
      .select(
        'whatsapp_phone, establishment_name, subscription_plan, selected_plan, language, address, seo_keywords, ai_tone, ai_length, ai_custom_instructions, phone, email, omni_recursive_prompt_addon'
      )
      .eq('id', userId)
      .single(),
  ]);

  const { data: profile, error: profileError } = profileResult;
  if (profileError || !profile) {
    return { success: false, error: 'Profile not found' };
  }

  const whatsappPhone = profile.whatsapp_phone?.trim();
  const planSlug = toPlanSlug(profile.subscription_plan ?? null, profile.selected_plan ?? null);
  const seoKeywords = Array.isArray(profile.seo_keywords)
    ? profile.seo_keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
    : [];
  const establishmentName = profile.establishment_name?.trim() || 'établissement';
  const businessContext = [seoKeywords[0], (profile.address as string)?.trim()].filter(Boolean).join(' à ') || establishmentName;
  const profileLanguage = (profile.language as string) ?? 'fr';

  const { data: lastPubRow } = await supabase
    .from('reviews')
    .select('response_text, ai_response')
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastPubText =
    (typeof lastPubRow?.response_text === 'string' && lastPubRow.response_text) ||
    (typeof lastPubRow?.ai_response === 'string' && lastPubRow.ai_response) ||
    null;
  const openingPatternIdx = nextOpeningPatternIndex(
    standardReview.text,
    standardReview.author,
    lastPubText
  );

  // ── 2. Generate AI suggested reply (même moteur que le dashboard ; tonalité courte pour WhatsApp) ──
  const suggestedReply = await produceWhatsAppSuggestedReply({
    planSlug,
    comment: standardReview.text,
    reviewerName: standardReview.author,
    rating: standardReview.rating,
    establishmentName,
    businessContext,
    seoKeywords,
    profileLanguage,
    aiTone: profile.ai_tone as string | null,
    aiLength: profile.ai_length as string | null,
    aiCustomInstructions: profile.ai_custom_instructions as string | null,
    phone: profile.phone as string | null,
    email: profile.email as string | null,
    openingPatternIdx,
  });

  // ── 3. Build review record ──
  const now = new Date().toISOString();
  const reviewRecord: Record<string, unknown> = {
    user_id: userId,
    reviewer_name: standardReview.author,
    rating: standardReview.rating,
    comment: standardReview.text,
    source: platform,
    // Toxic reviews stay in 'pending' — never auto-published
    status: toxicityResult.isToxic ? 'pending' : 'pending',
    ai_response: suggestedReply,
    whatsapp_sent: false,
    // Shield toxicity fields
    is_toxic: toxicityResult.isToxic,
    toxicity_reason: toxicityResult.reason,
    toxicity_complaint_text: toxicityResult.complaintText,
    toxicity_legal_argumentation: toxicityResult.legalArgumentation,
    toxicity_created_at: toxicityResult.isToxic ? now : null,
    toxicity_analyzed_at: now, // Always mark as analyzed
  };

  // ── 4. Insert or update review in DB ──
  let finalReviewId = reviewId;
  if (!finalReviewId) {
    const { data: newReview, error: insertError } = await supabase
      .from('reviews')
      .insert(reviewRecord)
      .select('id')
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }
    finalReviewId = newReview?.id;
  } else {
    // Existing review: update with toxicity data + AI response
    await supabase
      .from('reviews')
      .update({
        ai_response: suggestedReply,
        is_toxic: toxicityResult.isToxic,
        toxicity_reason: toxicityResult.reason,
        toxicity_complaint_text: toxicityResult.complaintText,
        toxicity_legal_argumentation: toxicityResult.legalArgumentation,
        toxicity_created_at: toxicityResult.isToxic ? now : null,
        toxicity_analyzed_at: now,
      })
      .eq('id', finalReviewId)
      .eq('user_id', userId);
  }

  if (!whatsappPhone || !hasFeature(planSlug, FEATURES.WHATSAPP_ALERTS)) {
    return {
      success: true,
      reviewId: finalReviewId,
      suggestedReply,
      isToxic: toxicityResult.isToxic,
      whatsappSent: false,
      error: !whatsappPhone
        ? 'WhatsApp phone not configured — review saved without alert'
        : 'WhatsApp alerts require Pulse or Zénith — review saved without alert',
    };
  }

  // ── 5. WhatsApp alert (Pulse / Zenith) ──
  const result = await sendWhatsAppAlert({
    to: whatsappPhone,
    reviewId: finalReviewId!,
    reviewerName: standardReview.author,
    rating: standardReview.rating,
    comment: standardReview.text,
    suggestedReply,
    establishmentName: profile.establishment_name ?? undefined,
    platform,
  });

  if (result.success) {
    await supabase
      .from('reviews')
      .update({ whatsapp_sent: true })
      .eq('id', finalReviewId)
      .eq('user_id', userId);

    let toPhone = profile.whatsapp_phone.trim().replace(/\D/g, '');
    if (toPhone.startsWith('0') && toPhone.length === 10) toPhone = '33' + toPhone.slice(1);
    await supabase.from('whatsapp_outbound_mapping').insert({
      to_phone: toPhone,
      review_id: finalReviewId,
      twilio_message_sid: result.messageId ?? null,
    });
  }

  return {
    success: true,
    reviewId: finalReviewId,
    suggestedReply,
    isToxic: toxicityResult.isToxic,
    whatsappSent: result.success,
    error: result.error,
  };
}
