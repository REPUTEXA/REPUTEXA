import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { getTrialEndingSoonEmailHtml } from '@/lib/emails/templates';

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr').replace(/\/+$/, '');
const CRON_SECRET = process.env.CRON_SECRET;
const TRIAL_REMINDER_FROM = process.env.RESEND_TRIAL_REMINDER_FROM ?? process.env.RESEND_FROM ?? 'REPUTEXA <contact@reputexa.fr>';
const TRIAL_DAYS = 14;

/**
 * checkTrialEnd — Cron (1x/jour) : détecte les abonnements en essai finissant dans 3 jours.
 * Envoie un email via Resend avec le template TrialEndingSoon.
 * CTA = page Paramètres / Facturation du dashboard Reputexa (design premium) ; lien annulation en dessous.
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
    .eq('subscription_status', 'trialing')
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

  /** Page Paramètres / Facturation du dashboard (ancre #billing pour la section abonnement). */
  const dashboardBillingUrl = `${APP_URL}/fr/dashboard/settings#billing`;
  const planName = 'Zénith';
  const planPrice = '179€';

  let sent = 0;

  for (const p of profiles) {
    const trialEnd = p.trial_ends_at
      ? (p.trial_ends_at as string).slice(0, 10)
      : p.trial_started_at
        ? trialEndToDate(p.trial_started_at as string)
        : null;
    if (!trialEnd || trialEnd !== targetDateStr) continue;

    const fullName = (p.full_name || p.establishment_name || '') as string;
    const firstName = fullName.split(/\s+/)[0] || '';

    const trialEndFormatted = new Date(trialEnd + 'T12:00:00Z').toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const selectedPlan = (p.selected_plan ?? p.subscription_plan) as string | null;
    const currentPlanSlug = ['vision', 'pulse', 'zenith'].includes(selectedPlan ?? '')
      ? (selectedPlan as 'vision' | 'pulse' | 'zenith')
      : undefined;
    const planNameBySlug: Record<string, string> = { vision: 'Vision', pulse: 'Pulse', zenith: 'Zénith' };
    const planPriceBySlug: Record<string, string> = { vision: '59€', pulse: '97€', zenith: '179€' };
    const effectivePlanName = currentPlanSlug ? planNameBySlug[currentPlanSlug] ?? planName : planName;
    const effectivePlanPrice = currentPlanSlug ? planPriceBySlug[currentPlanSlug] ?? planPrice : planPrice;

    const html = getTrialEndingSoonEmailHtml({
      firstName: firstName || '',
      daysLeft: 3,
      dashboardBillingUrl,
      trialEndDate: trialEndFormatted,
      planName: effectivePlanName,
      planPrice: effectivePlanPrice,
      currentPlanSlug,
    });

    const result = await sendEmail({
      to: p.email as string,
      subject: 'Votre essai ZENITH se termine dans 3 jours — Choisissez votre plan',
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
