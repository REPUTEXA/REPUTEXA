import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeAudioFromUrl } from '@/lib/whisper';
import { generateModifiedResponse } from '@/lib/whatsapp-alerts/generate-modified-response';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '33' + digits.slice(1);
  return digits;
}

function isApproval(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'ok' || t === 'oui' || t === 'valider';
}

/**
 * Webhook pour les réponses texte/vocal de l'utilisateur après une alerte avis négatif.
 *
 * Twilio envoie application/x-www-form-urlencoded :
 * - Body : texte (ou vide si vocal)
 * - From : whatsapp:+33612345678
 * - NumMedia, MediaUrl0, MediaContentType0 : pour le vocal
 *
 * Logique :
 * - "OK" → validation (APPROVE_REPLY)
 * - Texte ou vocal ≠ OK → instruction de modification → IA génère V2 → envoi sur WhatsApp
 */
export async function POST(request: Request) {
  try {
    console.log('[whatsapp-reply] Webhook Twilio appelé');

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/x-www-form-urlencoded')) {
      return NextResponse.json({ error: 'Expected form-urlencoded' }, { status: 400 });
    }

    const form = await request.formData();
    const body = form.get('Body')?.toString()?.trim() ?? '';
    const fromRaw = form.get('From')?.toString() ?? '';
    const numMedia = parseInt(form.get('NumMedia')?.toString() ?? '0', 10);
    const mediaUrl = form.get('MediaUrl0')?.toString();
    const mediaType = form.get('MediaContentType0')?.toString() ?? '';

    const fromPhone = fromRaw.replace(/^whatsapp:/, '');
    const normalized = normalizePhone(fromPhone);

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { data: mapping } = await supabase
      .from('whatsapp_outbound_mapping')
      .select('review_id')
      .eq('to_phone', normalized)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const reviewId = mapping?.review_id;
    if (!reviewId) {
      return NextResponse.json({ error: 'Aucune alerte en attente pour ce numéro' }, { status: 400 });
    }

    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id, comment, ai_response')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    let instruction: string;

    if (numMedia >= 1 && mediaUrl && mediaType?.toLowerCase().startsWith('audio/')) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!accountSid || !authToken) {
        return NextResponse.json({ error: 'Twilio not configured for voice' }, { status: 500 });
      }
      instruction = await transcribeAudioFromUrl(mediaUrl, {
        twilioAuth: { accountSid, authToken },
        language: 'fr',
      });
    } else {
      instruction = body;
    }

    if (!instruction || !instruction.trim()) {
      const sent = await sendWhatsAppMessage(fromPhone, "Je n'ai pas pu comprendre votre message. Envoyez du texte ou un vocal pour modifier la réponse, ou tapez OK pour valider.");
      return NextResponse.json({ success: false, reason: 'empty_instruction', sent: sent.success });
    }

    if (isApproval(instruction)) {
      const textToPublish = (review.ai_response ?? '').trim();
      if (!textToPublish) {
        await sendWhatsAppMessage(fromPhone, "Aucune réponse à valider. Envoyez une instruction pour générer une modification.");
        return NextResponse.json({ success: false, reason: 'no_reply' });
      }
      await supabase
        .from('reviews')
        .update({ response_text: textToPublish, status: 'scheduled' })
        .eq('id', reviewId)
        .eq('user_id', review.user_id);
      await sendWhatsAppMessage(fromPhone, "✅ Réponse validée ! Elle sera publiée prochainement.");
      return NextResponse.json({ success: true, action: 'approve' });
    }

    const firstResponse = (review.ai_response ?? '').trim() || 'Réponse non disponible.';
    const v2 = await generateModifiedResponse({
      originalReview: review.comment,
      firstResponse,
      patronInstruction: instruction,
    });

    await supabase
      .from('reviews')
      .update({ ai_response: v2 })
      .eq('id', reviewId)
      .eq('user_id', review.user_id);

    const replyBody = `Entendu Chef ! Voici la version modifiée :\n\n${v2}`;
    const sendResult = await sendWhatsAppMessage(fromPhone, replyBody);

    if (!sendResult.success) {
      console.error('[whatsapp-reply] Send error:', sendResult.error);
      return NextResponse.json(
        { success: false, error: sendResult.error, v2 },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, action: 'modified' });
  } catch (error) {
    console.error('[webhooks/whatsapp-reply]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 }
    );
  }
}
