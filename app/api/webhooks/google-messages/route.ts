import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type GoogleMessagePayload = {
  userId?: string;
  googleConversationId?: string;
  customerName?: string;
  messageText?: string;
};

async function sendWhatsAppMessage(to: string, body: string): Promise<{ simulated: boolean }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.log('[google-messages] Twilio non configuré, envoi simulé vers', to, 'message:', body);
    return { simulated: true };
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
      console.error('[google-messages] Twilio error', res.status, text.slice(0, 300));
      return { simulated: true };
    }
    return { simulated: false };
  } catch (e) {
    console.error('[google-messages] Twilio request failed', e);
    return { simulated: true };
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as GoogleMessagePayload;
    const userId = body.userId?.trim();
    const googleConversationId = body.googleConversationId?.trim();
    const customerName = (body.customerName ?? '').trim();
    const messageText = (body.messageText ?? '').trim();

    if (!userId || !googleConversationId || !messageText) {
      return NextResponse.json(
        { error: 'userId, googleConversationId et messageText sont requis' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin non configuré' }, { status: 500 });
    }

    const now = new Date().toISOString();

    // 1. Récupérer le numéro WhatsApp du patron
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('whatsapp_phone')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[google-messages] profileError', profileError);
    }

    const patronWhatsApp = (profile?.whatsapp_phone as string | null)?.trim() || null;

    // 2. Chercher ou créer le thread
    const { data: existingThreads } = await admin
      .from('conversation_threads')
      .select('id, patron_whatsapp_number')
      .eq('user_id', userId)
      .eq('google_conversation_id', googleConversationId)
      .limit(1);

    let threadId: string | null = existingThreads?.[0]?.id ?? null;

    if (!threadId) {
      const insertPayload = {
        user_id: userId,
        channel: 'google',
        google_conversation_id: googleConversationId,
        customer_name: customerName || null,
        patron_whatsapp_number: patronWhatsApp,
        status: 'open',
        last_customer_message: messageText,
        last_customer_at: now,
        last_owner_at: null,
      };
      const { data: inserted, error: insertError } = await admin
        .from('conversation_threads')
        .insert(insertPayload)
        .select('id')
        .limit(1);
      if (insertError || !inserted?.[0]?.id) {
        console.error('[google-messages] insert thread error', insertError);
        return NextResponse.json({ error: 'Impossible de créer le thread' }, { status: 500 });
      }
      threadId = inserted[0].id as string;
    } else {
      const updates: Record<string, unknown> = {
        last_customer_message: messageText,
        last_customer_at: now,
        status: 'open',
      };
      if (patronWhatsApp && !existingThreads?.[0]?.patron_whatsapp_number) {
        updates.patron_whatsapp_number = patronWhatsApp;
      }
      await admin
        .from('conversation_threads')
        .update(updates)
        .eq('id', threadId);
    }

    // 3. Envoyer une alerte WhatsApp au patron
    if (patronWhatsApp) {
      const to = patronWhatsApp.startsWith('whatsapp:')
        ? patronWhatsApp
        : `whatsapp:${patronWhatsApp}`;
      const preview = messageText.length > 180 ? `${messageText.slice(0, 177)}…` : messageText;
      const bodyText = `📩 Nouveau message Google Maps de ${customerName || 'un client'} :\n\n"${preview}"\n\nRépondez directement à ce message pour répondre au client sur Google Maps.`;
      await sendWhatsAppMessage(to, bodyText);
    }

    // 4. Planifier un rappel IA dans 5 minutes
    if (threadId) {
      const runAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await admin.from('ai_reminders').insert({
        thread_id: threadId,
        run_at: runAt,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[webhooks/google-messages] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 }
    );
  }
}

