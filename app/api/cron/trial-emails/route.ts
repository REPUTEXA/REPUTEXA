import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { getUrgencyEmailHtml, getExpirationEmailHtml } from '@/lib/emails/templates';

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.com';
const CRON_SECRET = process.env.CRON_SECRET;
const TRIAL_DAYS = 14;

const PLAN_DISPLAY: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'Zenith',
};

/**
 * Cron (ex: Vercel Cron ou cron-job.org) : chaque matin.
 * Envoie J-3 (urgence + promo REPUTEXA10) et J-0 (expiration) aux profils concernés.
 * Sécurisé par CRON_SECRET (header Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 });
  }

  if (!canSendEmail()) {
    return NextResponse.json({ ok: true, message: 'Resend not configured, skip emails' }, { status: 200 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const trialEndToDate = (start: string, daysOffset: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, establishment_name, trial_started_at, trial_ends_at, subscription_status, selected_plan')
    .not('email', 'is', null)
    .eq('subscription_status', 'trialing');

  if (!profiles?.length) {
    return NextResponse.json({ ok: true, sent: { j3: 0, j0: 0 } }, { status: 200 });
  }

  let sentJ3 = 0;
  let sentJ0 = 0;

  const todayTime = today.getTime();

  for (const p of profiles) {
    const trialEnd = p.trial_ends_at
      ? new Date(p.trial_ends_at as string).getTime()
      : p.trial_started_at
        ? trialEndToDate(p.trial_started_at as string, TRIAL_DAYS)
        : 0;
    if (!trialEnd) continue;

    const planSlug = (p.selected_plan as string) || 'zenith';
    const upgradeUrl = `${APP_URL}/fr/upgrade`;
    const establishmentName = (p.establishment_name as string) || '';
    const email = p.email as string;

    const endDay = new Date(trialEnd);
    endDay.setHours(0, 0, 0, 0);
    const j3Day = new Date(trialEnd);
    j3Day.setDate(j3Day.getDate() - 3);
    j3Day.setHours(0, 0, 0, 0);
    if (j3Day.getTime() === todayTime) {
      const html = getUrgencyEmailHtml({
        establishmentName,
        daysLeft: 3,
        checkoutUrl: upgradeUrl,
      });
      const result = await sendEmail({
        to: email,
        subject: '⚠️ Votre Bouclier IA expire bientôt — -10% avec REPUTEXA10',
        html,
      });
      if (result.success) sentJ3++;
    }

    if (endDay.getTime() === todayTime) {
      const planName = PLAN_DISPLAY[planSlug] ?? 'Zenith';
      const html = getExpirationEmailHtml({
        establishmentName,
        planName,
        checkoutUrl: upgradeUrl,
      });
      const result = await sendEmail({
        to: email,
        subject: 'Votre essai REPUTEXA est terminé — Activez votre abonnement',
        html,
      });
      if (result.success) sentJ0++;
    }
  }

  return NextResponse.json({ ok: true, sent: { j3: sentJ3, j0: sentJ0 } }, { status: 200 });
}
