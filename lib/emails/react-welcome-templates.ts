import { render } from '@react-email/render';
import React from 'react';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { WelcomeZenithTrial } from '@/components/emails/WelcomeZenithTrial';
import { WelcomePaid } from '@/components/emails/WelcomePaid';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reputexa.fr';

/**
 * Template Zénith (essai gratuit) — 14 jours, missions, date de fin.
 * Objet : 🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.
 */
export async function getWelcomeZenithTrialHtml(params: {
  loginUrl?: string;
  settingsUrl?: string;
}) {
  const loginUrl = params.loginUrl ?? `${APP_URL}/fr/dashboard`;
  const settingsUrl = params.settingsUrl ?? `${APP_URL}/fr/dashboard/settings`;
  const trialEndDate = format(addDays(new Date(), 14), 'd MMMM yyyy', { locale: fr });

  const html = await render(
    React.createElement(WelcomeZenithTrial, {
      loginUrl,
      settingsUrl,
      trialEndDate,
    })
  );
  return html;
}

/**
 * Template Pulse / Vision (payants) — ton pro, surveillance 24/7, lien guide.
 */
export async function getWelcomePaidHtml(params: {
  planName: string;
  establishmentName?: string;
  loginUrl?: string;
  guideUrl?: string;
}) {
  const loginUrl = params.loginUrl ?? `${APP_URL}/fr/dashboard`;
  const guideUrl = params.guideUrl ?? `${APP_URL}/fr/dashboard`;

  const html = await render(
    React.createElement(WelcomePaid, {
      planName: params.planName,
      establishmentName: params.establishmentName ?? '',
      loginUrl,
      guideUrl,
    })
  );
  return html;
}
