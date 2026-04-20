import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppAlert } from '@/lib/whatsapp-alerts/send-whatsapp-alert';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

/**
 * Alerte commerçant : avis négatif → WhatsApp via Twilio (sendWhatsAppAlert).
 * Met à jour reviews.whatsapp_sent après envoi réussi.
 */
export async function POST(request: Request) {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  try {
    const body = await request.json().catch(() => ({}));
    const { reviewId } = body as { reviewId?: string };

    if (!reviewId) {
      return apiJsonError(request, 'errors.reviewIdRequired', 400);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_phone, establishment_name, full_name, subscription_plan, selected_plan')
      .eq('id', user.id)
      .single();

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    if (!hasFeature(planSlug, FEATURES.WHATSAPP_ALERTS)) {
      return apiJsonError(request, 'errors.notifyWhatsapp_planPulseRequired', 403);
    }

    const to = profile?.whatsapp_phone?.trim();
    if (!to) {
      return apiJsonError(request, 'errors.notifyWhatsapp_phoneNotConfigured', 422);
    }

    const { data: review } = await supabase
      .from('reviews')
      .select('id, rating, comment, reviewer_name')
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .single();

    if (!review) {
      return apiJsonError(request, 'errors.reviewNotFound', 404);
    }

    const establishmentName =
      profile?.establishment_name?.trim() || profile?.full_name?.trim() || undefined;

    const sendResult = await sendWhatsAppAlert({
      to,
      reviewId: review.id,
      reviewerName: review.reviewer_name ?? t('notifyWhatsapp_defaultReviewer'),
      rating: review.rating,
      comment: review.comment ?? '',
      suggestedReply: '—',
      establishmentName,
      platform: 'google',
    });

    if (!sendResult.success) {
      console.error('[notify/whatsapp] Twilio:', sendResult.error);
      return apiJsonError(request, 'errors.crm_whatsappSendFailed', 502);
    }

    await supabase
      .from('reviews')
      .update({ whatsapp_sent: true })
      .eq('id', reviewId)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      message: t('notifyWhatsapp_alertSent'),
    });
  } catch (error) {
    console.error('[notify/whatsapp]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
