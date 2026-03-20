import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { getAuthEmailHtml } from '@/lib/emails/templates';
import { getSiteUrl } from '@/lib/site-url';

/**
 * POST /api/auth/email-change
 * Génère un lien de confirmation de changement d'email via supabase admin,
 * puis l'envoie à la nouvelle adresse avec le template Reputexa.
 * Le SMTP par défaut Supabase doit être désactivé côté console.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const newEmail =
      typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
    const locale = typeof body.locale === 'string' ? body.locale : 'fr';

    if (!newEmail) {
      return NextResponse.json({ error: 'newEmail required' }, { status: 400 });
    }

    // Récupère l'utilisateur connecté via le cookie de session
    const supabase = await createClient();
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user?.email) {
      return NextResponse.json({ error: 'Session expirée. Reconnectez-vous.' }, { status: 401 });
    }

    if (user.email === newEmail) {
      return NextResponse.json(
        { error: 'La nouvelle adresse est identique à l\'adresse actuelle.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    // Construction de l'URL de callback sécurisée
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? getSiteUrl();
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const redirectTo = `${baseUrl}/${locale}/auth/callback?next=/dashboard/settings`;

    // Génération du lien sécurisé via l'admin SDK (contourne le SMTP Supabase)
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'email_change_new',
      email: user.email,
      newEmail,
      options: { redirectTo },
    });

    if (error) {
      console.error('[email-change] generateLink error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Extraction de l'action_link dans la réponse admin
    const raw = (data ?? {}) as Record<string, unknown>;
    const props = (raw.properties ?? raw) as Record<string, unknown>;
    const actionLink =
      (typeof props.action_link === 'string' ? props.action_link : null) ??
      (typeof raw.action_link === 'string' ? raw.action_link : null);

    if (!actionLink) {
      console.error('[email-change] No action_link in response', Object.keys(data ?? {}));
      return NextResponse.json({ error: 'Failed to generate confirmation link' }, { status: 500 });
    }

    // Mode développement sans service email configuré
    if (!canSendEmail()) {
      console.log('[email-change] Service email non configuré — lien (dev):', actionLink);
      return NextResponse.json({ sent: false, reason: 'Email service not configured' });
    }

    const html = getAuthEmailHtml(actionLink, 'email_change');
    const result = await sendEmail({
      to: newEmail,
      subject: 'Confirmez votre nouvel email REPUTEXA',
      html,
      from: process.env.RESEND_FROM ?? DEFAULT_FROM,
    });

    if (!result.success) {
      console.error('[email-change] Email sending error:', result.error);
      return NextResponse.json(
        { error: 'Impossible d\'envoyer l\'email de confirmation. Réessayez dans quelques instants.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error('[email-change]', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
