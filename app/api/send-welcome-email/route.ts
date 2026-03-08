import { NextResponse } from 'next/server';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { getWelcomeEmailHtml } from '@/lib/emails/templates';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Envoi email J+0 (Bienvenue) après inscription.
 * Appelé par le client après signUp Supabase réussi.
 */
export async function POST(request: Request) {
  try {
    if (!canSendEmail()) {
      console.log('[send-welcome-email] Resend non configuré — Email envoyé (simulé en local)');
      return NextResponse.json({ sent: false, reason: 'Resend not configured' }, { status: 200 });
    }
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const establishmentName = typeof body.establishmentName === 'string' ? body.establishmentName.trim() : '';
    const locale = typeof body.locale === 'string' ? body.locale : 'fr';
    const type = (body.type === 'premium' ? 'premium' : 'trial') as 'trial' | 'premium';

    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const loginUrl = `${getSiteUrl()}/${locale}/dashboard`;
    const PLAN_DISPLAY: Record<string, string> = { vision: 'Vision', pulse: 'Pulse', zenith: 'Zenith' };
    const planName = PLAN_DISPLAY[body.planSlug as string] ?? 'Premium';

    const html = type === 'premium'
      ? (await import('@/lib/emails/templates')).getWelcomePremiumEmailHtml({ establishmentName, planName, loginUrl })
      : getWelcomeEmailHtml({ establishmentName, loginUrl });
    const subject = type === 'premium'
      ? 'Bienvenue en Premium REPUTEXA — Votre abonnement est actif'
      : 'Bienvenue chez REPUTEXA — Essai ZENITH 14 jours activé';
    const result = await sendEmail({
      to: email,
      subject,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ sent: false, error: result.error }, { status: 500 });
    }
    console.log('Email envoyé');
    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error('[send-welcome-email]', e);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
}
