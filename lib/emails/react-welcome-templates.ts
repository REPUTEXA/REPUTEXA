/**
 * Anciennement rendu React + textes en dur : les e-mails de bienvenue passent par
 * {@link ./templates} (Zenith + traductions `EmailTemplates` / locale utilisateur).
 * Conservé pour éviter une double source de vérité si un import historique subsiste.
 */
import { normalizeEmailLocale } from '@/lib/emails/auth-email-i18n';
import {
  getWelcomePaidHtml as getWelcomePaidHtmlFromTemplates,
  getWelcomeZenithTrialHtml as getWelcomeZenithTrialHtmlFromTemplates,
} from '@/lib/emails/templates';
import { getSiteUrl } from '@/src/lib/empire-settings';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? getSiteUrl();

function baseNoSlash(): string {
  return APP_URL.replace(/\/$/, '');
}

export function getWelcomeZenithTrialHtml(params: {
  loginUrl?: string;
  settingsUrl?: string;
  locale?: string | null;
}): string {
  const loc = normalizeEmailLocale(params.locale);
  const base = baseNoSlash();
  return getWelcomeZenithTrialHtmlFromTemplates({
    loginUrl: params.loginUrl ?? `${base}/${loc}/dashboard`,
    settingsUrl: params.settingsUrl ?? `${base}/${loc}/dashboard/settings`,
    locale: loc,
  });
}

export function getWelcomePaidHtml(params: {
  planName: string;
  establishmentName?: string;
  loginUrl?: string;
  guideUrl?: string;
  locale?: string | null;
}): string {
  const loc = normalizeEmailLocale(params.locale);
  const base = baseNoSlash();
  return getWelcomePaidHtmlFromTemplates({
    planName: params.planName,
    establishmentName: params.establishmentName ?? '',
    loginUrl: params.loginUrl ?? `${base}/${loc}/dashboard`,
    supportUrl: params.guideUrl ?? `${base}/${loc}/dashboard`,
    locale: loc,
  });
}
