import { createAdminClient } from '@/lib/supabase/admin';
import { CALLBACK_ACTIONS, type CallbackAction, type WhatsAppCallbackPayload } from './types';

export { CALLBACK_ACTIONS };
export type { CallbackAction, WhatsAppCallbackPayload };

/**
 * Traite les callbacks des boutons WhatsApp (APPROVE_REPLY, EDIT_REPLY).
 * Appelé depuis /api/webhooks/whatsapp-callback.
 */
export async function handleCallbackAction(
  payload: WhatsAppCallbackPayload
): Promise<{ success: boolean; error?: string }> {
  const { action, reviewId, replyText } = payload;

  const supabase = createAdminClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  if (!reviewId) {
    return { success: false, error: 'reviewId required' };
  }

  switch (action) {
    case CALLBACK_ACTIONS.APPROVE_REPLY: {
      const { data: review } = await supabase
        .from('reviews')
        .select('id, user_id, ai_response')
        .eq('id', reviewId)
        .single();

      if (!review) {
        return { success: false, error: 'Review not found' };
      }

      const textToPublish = review.ai_response ?? replyText ?? '';
      if (!textToPublish.trim()) {
        return { success: false, error: 'No reply text to approve' };
      }

      await supabase
        .from('reviews')
        .update({
          response_text: textToPublish.trim(),
          status: 'scheduled',
        })
        .eq('id', reviewId)
        .eq('user_id', review.user_id);

      console.log('[whatsapp-alerts] APPROVE_REPLY:', reviewId, 'response approved');
      return { success: true };
    }

    case CALLBACK_ACTIONS.EDIT_REPLY: {
      const { data: review } = await supabase
        .from('reviews')
        .select('id, user_id')
        .eq('id', reviewId)
        .single();

      if (!review) {
        return { success: false, error: 'Review not found' };
      }

      if (replyText?.trim()) {
        await supabase
          .from('reviews')
          .update({
            ai_response: replyText.trim(),
          })
          .eq('id', reviewId)
          .eq('user_id', review.user_id);
      }

      console.log('[whatsapp-alerts] EDIT_REPLY:', reviewId, replyText ? 'reply updated' : 'user will edit');
      // En production: envoyer un message WhatsApp "Répondez avec votre texte modifié"
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}
