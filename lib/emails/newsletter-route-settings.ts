import {
  expandInterfaceTemplate,
  getBrandName,
  getEmpireSettings,
  getInterfaceEmailSenderDefault,
  getInterfaceEmailSenderStrategic,
  getSiteUrl,
} from '@/src/lib/empire-settings';

/** URL publique (env > `targets/settings.json`). */
export function newsletterSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? getSiteUrl();
}

/** Expéditeur newsletter « Flux stratégique ». */
export function newsletterSenderStrategic(): string {
  return process.env.RESEND_FROM ?? getInterfaceEmailSenderStrategic();
}

/** Expéditeur générique (désabonnement, etc.). */
export function newsletterSenderDefault(): string {
  return process.env.RESEND_FROM ?? getInterfaceEmailSenderDefault();
}

export function newsletterBrandUpper(): string {
  return getBrandName();
}

/** Nom d’audience Resend (env `RESEND_NEWSLETTER_AUDIENCE_NAME` > `interface.resend_newsletter_audience_name`). */
export function newsletterResendAudienceName(): string {
  return (
    process.env.RESEND_NEWSLETTER_AUDIENCE_NAME ??
    getEmpireSettings().interface.resend_newsletter_audience_name
  );
}

export function newsletterSiteHostname(): string {
  try {
    return new URL(newsletterSiteUrl()).hostname;
  } catch {
    return 'reputexa.fr';
  }
}

export function newsletterStrategicFluxWelcomeSubject(): string {
  return expandInterfaceTemplate(
    getEmpireSettings().interface.newsletter_strategic_flux_welcome_subject_template
  );
}

export function newsletterUnsubscribeConfirmedSubject(): string {
  return expandInterfaceTemplate(
    getEmpireSettings().interface.newsletter_unsubscribe_confirmed_subject_template
  );
}
