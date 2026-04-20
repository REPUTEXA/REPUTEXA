import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { renderZenithEmail } from '@/lib/emails/templates';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

type RequestBody = {
  documentName?: string;
  summary?: string;
  targetLink?: string;
};

export async function POST(request: Request) {
  const ta = apiAdminT();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
    }

    const isAdmin =
      (user.app_metadata as { role?: string } | null)?.role === 'admin' ||
      (user.user_metadata as { role?: string } | null)?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
    }

    const { documentName, summary, targetLink }: RequestBody = await request
      .json()
      .catch(() => ({}));

    if (!documentName || !summary || !targetLink) {
      return NextResponse.json({ error: ta('legalNotifyFieldsRequired') }, { status: 400 });
    }

    if (!canSendEmail()) {
      return NextResponse.json({ error: ta('resendNotConfigured') }, { status: 500 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: ta('supabaseAdminMissing') }, { status: 500 });
    }

    const { data: profiles, error } = await admin
      .from('profiles')
      .select('email')
      .not('email', 'is', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const emails = Array.from(
      new Set(
        (profiles ?? [])
          .map((p) => (p as { email?: string }).email?.trim())
          .filter((e): e is string => !!e)
      )
    );

    if (emails.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const title = 'Mise à jour importante de nos conditions';
    const content = `
      <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">
        Bonjour,
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">
        Nous avons mis à jour nos <strong>${documentName}</strong>.
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">
        <strong>Ce qui change :</strong> ${summary}
      </p>
      <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">
        Ces modifications visent à mieux protéger vos données et à améliorer nos services.
      </p>
    `.trim();

    const html = renderZenithEmail(
      title,
      content,
      'Consulter la version complète',
      targetLink,
    );

    const subject =
      '⚖️ Mise à jour importante : nos conditions évoluent — REPUTEXA';

    const BATCH_SIZE = 50;
    let sentCount = 0;

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((to) =>
          sendEmail({
            to,
            subject,
            html,
            from: process.env.RESEND_FROM ?? DEFAULT_FROM,
          })
        )
      );
      sentCount += results.filter((r) => r.status === 'fulfilled').length;
    }

    return NextResponse.json({ sent: sentCount });
  } catch (err) {
    console.error('[admin/notify-legal-update] error', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : ta('notifyLegalUpdateFailed'),
      },
      { status: 500 }
    );
  }
}
