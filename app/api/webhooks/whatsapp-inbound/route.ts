import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeAudioFromUrl } from '@/lib/whisper';

type TwilioPayload = {
  From?: string;
  Body?: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
};

async function parseTwilioRequest(request: Request): Promise<TwilioPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    return {
      From: params.get('From') ?? undefined,
      Body: params.get('Body') ?? undefined,
      NumMedia: params.get('NumMedia') ?? undefined,
      MediaUrl0: params.get('MediaUrl0') ?? undefined,
      MediaContentType0: params.get('MediaContentType0') ?? undefined,
    };
  }
  return (await request.json().catch(() => ({}))) as TwilioPayload;
}

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.log('[whatsapp-inbound] Twilio non configuré, réponse simulée vers', to, 'message:', body);
    return;
  }

  try {
    const creds = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('From', from);
    params.append('To', to);
    params.append('Body', body);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[whatsapp-inbound] Twilio error', res.status, text.slice(0, 300));
    }
  } catch (e) {
    console.error('[whatsapp-inbound] Twilio request failed', e);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await parseTwilioRequest(request);
    const fromRaw = payload.From?.trim();
    let bodyText = (payload.Body ?? '').trim();

    if (!fromRaw) {
      return apiJsonError(request, 'errors.badRequest', 400);
    }

    const normalizedFrom = fromRaw.startsWith('whatsapp:')
      ? fromRaw.replace(/^whatsapp:/, '').trim()
      : fromRaw.trim();

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'supabaseAdminNotConfigured', 500);
    }

    // 1. Trouver l'utilisateur via son numéro WhatsApp (format international)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, whatsapp_phone, google_access_token')
      .eq('whatsapp_phone', normalizedFrom)
      .limit(1);

    const profile = profiles?.[0];
    if (!profile?.id) {
      console.warn('[whatsapp-inbound] Aucun profil pour le numéro', normalizedFrom);
      return NextResponse.json({ ok: true });
    }

    const userId = profile.id as string;
    const googleAccessToken = (profile.google_access_token as string | null) || null;

    // 2. Récupérer le thread Google ouvert le plus récent
    const { data: threads } = await admin
      .from('conversation_threads')
      .select('id, google_conversation_id, patron_whatsapp_number, last_customer_at')
      .eq('user_id', userId)
      .eq('channel', 'google')
      .eq('status', 'open')
      .order('last_customer_at', { ascending: false })
      .limit(1);

    const thread = threads?.[0];
    if (!thread?.id || !thread.google_conversation_id) {
      console.warn('[whatsapp-inbound] Aucun thread Google ouvert pour user', userId);
      return NextResponse.json({ ok: true });
    }

    // 3. Gérer média audio éventuel (message vocal)
    const hasMedia = Number(payload.NumMedia ?? '0') > 0;
    const mediaUrl = payload.MediaUrl0?.trim() || null;
    const mediaContentType = payload.MediaContentType0?.trim().toLowerCase() || '';
    let transcribedText: string | null = null;

    if (hasMedia && mediaUrl && (mediaContentType.startsWith('audio/') || mediaContentType.includes('audio'))) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!accountSid || !authToken) {
          console.warn('[whatsapp-inbound] Twilio credentials manquants pour transcription audio');
        } else {
          transcribedText = await transcribeAudioFromUrl(mediaUrl, {
            twilioAuth: { accountSid, authToken },
            language: 'fr',
          });
        }
      } catch (e) {
        console.error('[whatsapp-inbound] Échec transcription audio', e);
      }
    }

    // Si vocal transcrit, on remplace/complète le texte
    if (transcribedText && !bodyText) {
      bodyText = transcribedText.trim();
    } else if (transcribedText && bodyText) {
      bodyText = `${bodyText}\n\n(Transcription du vocal: ${transcribedText.trim()})`;
    }

    if (!bodyText) {
      return NextResponse.json({ ok: true });
    }

    // 4. Envoyer la réponse sur Google Business Messages
    if (googleAccessToken) {
      const endpoint = `https://businessmessages.googleapis.com/v1/${thread.google_conversation_id}/messages`;
      const gbmBody = {
        messageType: 'TEXT',
        text: bodyText,
      };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gbmBody),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error('[whatsapp-inbound] GBM error', res.status, text.slice(0, 300));
        }
      } catch (e) {
        console.error('[whatsapp-inbound] GBM request failed', e);
      }
    } else {
      console.warn('[whatsapp-inbound] Aucun google_access_token pour user', userId);
      const to = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${normalizedFrom}`;
      await sendWhatsAppMessage(
        to,
        "Nous n'avons pas pu envoyer votre réponse sur Google Maps (connexion expirée). Reconnectez Google dans vos paramètres Reputexa."
      );
    }

    // 5. Mettre à jour le thread
    const now = new Date().toISOString();
    await admin
      .from('conversation_threads')
      .update({ last_owner_at: now })
      .eq('id', thread.id);

    // 6. Confirmation au patron si vocal transcrit
    if (transcribedText) {
      const to = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${normalizedFrom}`;
      const preview = transcribedText.length > 160 ? `${transcribedText.slice(0, 157)}…` : transcribedText;
      await sendWhatsAppMessage(
        to,
        `✅ Votre vocal a été transcrit et envoyé sur Google Maps : "${preview}"`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[webhooks/whatsapp-inbound] failed', error);
    return apiJsonError(request, 'serverError', 500);
  }
}

