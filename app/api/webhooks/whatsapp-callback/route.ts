import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleCallbackAction, CALLBACK_ACTIONS } from '@/lib/whatsapp-alerts';
import type { WhatsAppCallbackPayload } from '@/lib/whatsapp-alerts';

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '33' + digits.slice(1);
  return digits;
}

/**
 * Webhook pour les callbacks des boutons WhatsApp (Twilio / Meta Cloud API).
 *
 * Twilio envoie application/x-www-form-urlencoded :
 * - Body ou ButtonPayload = "APPROVE_REPLY" | "EDIT_REPLY"
 * - From = whatsapp:+33612345678
 *
 * On résout reviewId via la table whatsapp_outbound_mapping (to_phone = From).
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let action: string | undefined;
    let fromPhone: string | undefined;
    let replyText: string | undefined;
    let reviewId: string | undefined;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await request.formData();
      const body = form.get('Body')?.toString() ?? form.get('ButtonPayload')?.toString();
      fromPhone = form.get('From')?.toString();
      action = body;
      replyText = form.get('Body')?.toString();
    } else {
      const body = await request.json().catch(() => ({}));

      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      if (value?.interactive?.button_reply) {
        action = value.interactive.button_reply.id;
        fromPhone = value.contacts?.[0]?.wa_id ?? value.from;
      } else {
        const payload = body as Partial<WhatsAppCallbackPayload>;
        action = payload.action;
        reviewId = payload.reviewId;
        replyText = payload.replyText;
      }
    }

    if (!action) {
      return apiJsonError(request, 'errors.whatsappCallback_actionRequired', 400);
    }

    if (action !== CALLBACK_ACTIONS.APPROVE_REPLY && action !== CALLBACK_ACTIONS.EDIT_REPLY) {
      return apiJsonError(request, 'errors.whatsappCallback_unknownAction', 400, { action });
    }

    if (!reviewId && fromPhone) {
      const supabase = createAdminClient();
      if (supabase) {
        const normalized = normalizePhone(fromPhone.replace(/^whatsapp:/, ''));
        const { data: mapping } = await supabase
          .from('whatsapp_outbound_mapping')
          .select('review_id')
          .eq('to_phone', normalized)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        reviewId = mapping?.review_id;
      }
    }

    if (!reviewId) {
      return NextResponse.json(
        { error: 'reviewId not found (mapping table or payload)' },
        { status: 400 }
      );
    }

    const result = await handleCallbackAction({
      action,
      reviewId,
      replyText,
    });

    if (!result.success) {
      return apiJsonError(request, 'serverError', 500);
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('[webhooks/whatsapp-callback]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
