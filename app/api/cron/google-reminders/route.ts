import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';

const CRON_SECRET = process.env.CRON_SECRET;

const openai =
  process.env.OPENAI_API_KEY != null
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.log('[google-reminders] Twilio non configuré, envoi simulé vers', to, 'message:', body);
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
      console.error('[google-reminders] Twilio error', res.status, text.slice(0, 300));
    }
  } catch (e) {
    console.error('[google-reminders] Twilio request failed', e);
  }
}

async function sendGbmMessage(conversationId: string, accessToken: string, text: string): Promise<void> {
  try {
    const endpoint = `https://businessmessages.googleapis.com/v1/${conversationId}/messages`;
    const body = {
      messageType: 'TEXT',
      text,
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('[google-reminders] GBM error', res.status, t.slice(0, 300));
    }
  } catch (e) {
    console.error('[google-reminders] GBM request failed', e);
  }
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('supabaseAdminMissing') }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { data: reminders, error: remindersError } = await admin
    .from('ai_reminders')
    .select('id, thread_id, run_at, processed')
    .eq('processed', false)
    .lte('run_at', nowIso)
    .limit(100);

  if (remindersError) {
    console.error('[google-reminders] remindersError', remindersError);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processedCount = 0;

  for (const reminder of reminders) {
    try {
      const { data: rows, error: threadError } = await admin
        .from('conversation_threads')
        .select('id, user_id, customer_name, google_conversation_id, patron_whatsapp_number, last_customer_at, last_owner_at, status')
        .eq('id', reminder.thread_id)
        .limit(1);

      if (threadError || !rows?.[0]) {
        if (threadError) console.error('[google-reminders] threadError', threadError);
        await admin.from('ai_reminders').update({ processed: true }).eq('id', reminder.id);
        continue;
      }

      const thread = rows[0] as {
        id: string;
        user_id: string;
        customer_name: string | null;
        google_conversation_id: string | null;
        patron_whatsapp_number: string | null;
        last_customer_at: string | null;
        last_owner_at: string | null;
        status: string;
      };

      if (!thread.last_customer_at || !thread.google_conversation_id) {
        await admin.from('ai_reminders').update({ processed: true }).eq('id', reminder.id);
        continue;
      }

      // Si le patron a déjà répondu après le dernier message client, on ignore
      if (thread.last_owner_at && thread.last_owner_at >= thread.last_customer_at) {
        await admin.from('ai_reminders').update({ processed: true }).eq('id', reminder.id);
        continue;
      }

      // Récupérer le profil pour connaître le plan et les tokens
      const { data: profiles, error: profileError } = await admin
        .from('profiles')
        .select('subscription_plan, selected_plan, google_access_token, whatsapp_phone')
        .eq('id', thread.user_id)
        .limit(1);

      if (profileError || !profiles?.[0]) {
        if (profileError) console.error('[google-reminders] profileError', profileError);
        await admin.from('ai_reminders').update({ processed: true }).eq('id', reminder.id);
        continue;
      }

      const profile = profiles[0] as {
        subscription_plan: string | null;
        selected_plan: string | null;
        google_access_token: string | null;
        whatsapp_phone: string | null;
      };

      const planSlug = (profile.selected_plan ?? profile.subscription_plan ?? 'vision') as string;
      const isZenith = planSlug === 'zenith';
      const patronWhatsApp = (profile.whatsapp_phone ?? thread.patron_whatsapp_number ?? '').trim();
      const customerName = thread.customer_name || 'un client';

      if (isZenith && profile.google_access_token) {
        // Génération IA simple pour la démo (ton professionnel, optimisé avis)
        let aiText =
          `Bonjour, merci pour votre message. Nous l'avons bien reçu et nous revenons vers vous très rapidement.` +
          ` Nous attachons une grande importance à votre expérience et utilisons vos retours pour améliorer notre service.`;

        if (openai) {
          try {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              temperature: 0.7,
              messages: [
                {
                  role: 'system',
                  content:
                    'Tu es un expert en e-réputation. Rédige une courte réponse professionnelle et bienveillante à un message Google Maps, ' +
                    'en intégrant naturellement 1 ou 2 mots-clés SEO sur le type d’établissement (restaurant, hôtel, etc.). Réponse en français uniquement.',
                },
                {
                  role: 'user',
                  content: `Client: ${customerName}. Rédige une réponse de 2 à 4 phrases.`,
                },
              ],
            });
            const content = completion.choices[0]?.message?.content?.trim();
            if (content) aiText = content;
          } catch (e) {
            console.error('[google-reminders] OpenAI failed', e);
          }
        }

        await sendGbmMessage(thread.google_conversation_id, profile.google_access_token, aiText);

        if (patronWhatsApp) {
          const to = patronWhatsApp.startsWith('whatsapp:')
            ? patronWhatsApp
            : `whatsapp:${patronWhatsApp}`;
          await sendWhatsAppMessage(
            to,
            "L'IA Zénith a répondu automatiquement pour vous ✨. Vous pouvez ajuster la réponse depuis votre dashboard si besoin."
          );
        }

        await admin
          .from('conversation_threads')
          .update({ last_owner_at: new Date().toISOString() })
          .eq('id', thread.id);
      } else {
        // Autres plans : simple rappel WhatsApp
        if (patronWhatsApp) {
          const to = patronWhatsApp.startsWith('whatsapp:')
            ? patronWhatsApp
            : `whatsapp:${patronWhatsApp}`;
          await sendWhatsAppMessage(
            to,
            `⚠️ Rappel : Vous n'avez pas encore répondu à ${customerName} sur Google Maps. Répondez à ce message pour lui répondre.`
          );
        }
      }

      await admin.from('ai_reminders').update({ processed: true }).eq('id', reminder.id);
      processedCount += 1;
    } catch (e) {
      console.error('[google-reminders] processing reminder failed', reminder.id, e);
      await admin.from('ai_reminders').update({ processed: true }).eq('id', reminder.id);
    }
  }

  return NextResponse.json({ ok: true, processed: processedCount });
}

