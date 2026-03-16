import { createAdminClient } from '@/lib/supabase/admin';
import { generateSuggestedResponse } from './generate-ai-response';
import { sendWhatsAppAlert } from './send-whatsapp-alert';
import type { GoogleReviewWebhookPayload, ReviewPlatform, StandardReview } from './types';

/**
 * Traite un avis négatif : génère une réponse IA et envoie l'alerte WhatsApp.
 */
export async function processBadReview(
  payload: GoogleReviewWebhookPayload
): Promise<{
  success: boolean;
  reviewId?: string;
  suggestedReply?: string;
  whatsappSent?: boolean;
  error?: string;
}> {
  const { userId, reviewerName, rating, comment, source, reviewId } = payload;

  const platform: ReviewPlatform = source ?? 'google';
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

  // Récupérer le profil (whatsapp_phone, establishment_name)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('whatsapp_phone, establishment_name')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Profile not found' };
  }

  const whatsappPhone = profile.whatsapp_phone?.trim();
  if (!whatsappPhone) {
    return {
      success: false,
      error: 'WhatsApp phone not configured for this user',
      reviewId,
    };
  }

  // Générer la réponse IA suggérée (adaptée à la plateforme)
  const suggestedReply = await generateSuggestedResponse({
    comment: standardReview.text,
    rating: standardReview.rating,
    establishmentName: profile.establishment_name ?? undefined,
    platform,
  });

  // Créer ou mettre à jour la review si on a un reviewId
  let finalReviewId = reviewId;
  if (!finalReviewId) {
    const { data: newReview, error: insertError } = await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        reviewer_name: standardReview.author,
        rating: standardReview.rating,
        comment: standardReview.text,
        source: platform,
        status: 'pending',
        ai_response: suggestedReply,
        whatsapp_sent: false,
      })
      .select('id')
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }
    finalReviewId = newReview?.id;
  } else {
    // Mise à jour de la réponse suggérée
    await supabase
      .from('reviews')
      .update({ ai_response: suggestedReply })
      .eq('id', finalReviewId)
      .eq('user_id', userId);
  }

  // Envoyer l'alerte WhatsApp via Twilio
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

    // Mapping pour les callbacks (boutons Approuver/Modifier)
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
    whatsappSent: result.success,
    error: result.error,
  };
}
