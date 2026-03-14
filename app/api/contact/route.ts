import { NextResponse } from 'next/server';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';

const CONTACT_EMAIL = 'contact@reputexa.fr';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const subject = String(body.subject ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Tous les champs sont obligatoires.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Adresse email invalide.' },
        { status: 400 }
      );
    }

    if (!canSendEmail()) {
      console.warn('[contact] Resend non configuré');
      return NextResponse.json(
        { error: 'Le formulaire de contact est temporairement indisponible. Envoyez-nous un email à contact@reputexa.fr.' },
        { status: 503 }
      );
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nouveau message depuis le formulaire REPUTEXA</h2>
        <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
        <p><strong>Email :</strong> ${escapeHtml(email)}</p>
        <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;" />
        <p><strong>Message :</strong></p>
        <p style="white-space: pre-wrap; background: #f8fafc; padding: 1rem; border-radius: 8px;">${escapeHtml(message)}</p>
      </div>
    `;

    const { success, error } = await sendEmail({
      from: DEFAULT_FROM,
      to: CONTACT_EMAIL,
      subject: `[REPUTEXA Contact] ${subject}`,
      html,
      // Reply-To pour pouvoir répondre directement au client
    });

    if (!success) {
      console.error('[contact] Envoi échoué:', error);
      return NextResponse.json(
        { error: 'Une erreur est survenue lors de l\'envoi. Réessayez ou contactez-nous à contact@reputexa.fr.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[contact]', err);
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
