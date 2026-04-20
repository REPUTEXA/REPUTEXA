import { getSiteUrl } from '@/lib/site-url';

export async function sendTeamInviteWhatsApp(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.warn('[team-invite] Twilio WhatsApp non configuré, message non envoyé.');
    return { ok: false, error: 'whatsapp_not_configured' };
  }

  const to = toE164.startsWith('whatsapp:') ? toE164 : `whatsapp:${toE164}`;

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
      console.error('[team-invite] Twilio', res.status, text.slice(0, 400));
      return { ok: false, error: 'twilio_error' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[team-invite] Twilio request failed', e);
    return { ok: false, error: 'twilio_error' };
  }
}

export function buildTeamInviteMessage(params: {
  inviteeFirstName: string;
  establishmentName: string;
  joinUrl: string;
}): string {
  const name = params.inviteeFirstName.trim() || 'Bonjour';
  const shop = params.establishmentName.trim() || 'votre enseigne';
  return `${name} ! Bienvenue chez ${shop}. Votre patron vous invite à rejoindre l'espace REPUTEXA de l'entreprise. Configurez votre accès : ${params.joinUrl}`;
}

export function absoluteJoinUrl(locale: string, token: string): string {
  const base = getSiteUrl().replace(/\/+$/, '');
  return `${base}/${locale}/join/${encodeURIComponent(token)}`;
}
