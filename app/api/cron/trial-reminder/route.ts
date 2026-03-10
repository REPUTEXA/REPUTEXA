import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { getTrialReminder3DaysHtml } from '@/lib/emails/templates';

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
const CRON_SECRET = process.env.CRON_SECRET;
const TRIAL_REMINDER_FROM = process.env.RESEND_TRIAL_REMINDER_FROM ?? 'REPUTEXA <contact@reputexa.fr>';
const TRIAL_DAYS = 14;

const PLAN_DISPLAY: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'ZENITH',
};

/**
 * Cron (1x/jour) : envoie le rappel J-3 aux utilisateurs dont trial_ends_at est dans 3 jours.
 * Ne cible que les profils sans abonnement actif et qui n'ont pas encore reçu le mail.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 });
  }

  if (!canSendEmail()) {
    return NextResponse.json({ ok: true, message: 'Resend not configured' }, { status: 200 });
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in3DaysUtc = new Date(todayUtc);
  in3DaysUtc.setUTCDate(in3DaysUtc.getUTCDate() + 3);
  const targetDateStr = in3DaysUtc.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, establishment_name, trial_ends_at, trial_started_at, trial_reminder_sent, subscription_status, selected_plan, subscription_plan')
    .not('email', 'is', null)
    .neq('subscription_status', 'active')
    .or(`trial_reminder_sent.is.null,trial_reminder_sent.eq.false`);

  if (!profiles?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No eligible profiles' }, { status: 200 });
  }

  const trialEndToDate = (start: string) => {
    const d = new Date(start);
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    utc.setUTCDate(utc.getUTCDate() + TRIAL_DAYS);
    return utc.toISOString().slice(0, 10);
  };

  let sent = 0;

  for (const p of profiles) {
    const trialEnd = p.trial_ends_at
      ? (p.trial_ends_at as string).slice(0, 10)
      : p.trial_started_at
        ? trialEndToDate(p.trial_started_at as string)
        : null;
    if (!trialEnd || trialEnd !== targetDateStr) continue;

    const planSlug = (p.selected_plan || p.subscription_plan || 'zenith') as string;
    const planName = PLAN_DISPLAY[planSlug] ?? 'ZENITH';
    const checkoutUrl = `${APP_URL}/fr/checkout?plan=${planSlug}&trial=0`;
    const fullName = (p.full_name || p.establishment_name || '') as string;
    const firstName = fullName.split(/\s+/)[0] || '';

    const { count } = await admin
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', p.id)
      .not('response_text', 'is', null);
    const reviewsRepliedCount = count ?? 0;

    const html = getTrialReminder3DaysHtml({
      firstName: firstName || 'Bonjour',
      planName,
      reviewsRepliedCount,
      checkoutUrl,
    });

    const result = await sendEmail({
      to: p.email as string,
      subject: '⏳ Plus que 3 jours pour sécuriser votre réputation sur Reputexa',
      html,
      from: TRIAL_REMINDER_FROM,
    });

    if (result.success) {
      await admin
        .from('profiles')
        .update({ trial_reminder_sent: true })
        .eq('id', p.id);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent }, { status: 200 });
}
