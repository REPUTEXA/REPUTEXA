/**
 * Simulation debug — URLs envoyées par email.
 * Activer avec : DEBUG_EMAIL_URLS=1
 */

const DEBUG = process.env.DEBUG_EMAIL_URLS === '1';

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://reputexa.fr'
  );
}

export function logSignupUrls(email: string, locale: string): void {
  if (!DEBUG) return;
  const base = getBaseUrl();
  const confirmUrl = `${base}/${locale}/verify?email=${encodeURIComponent(email)}`;
  const dashboardUrl = `${base}/${locale}/dashboard`;
  console.log('\n[DEBUG EMAIL] --- Signup ---');
  console.log('[DEBUG EMAIL] Redirect post-signup (vers confirm-email):', confirmUrl);
  console.log('[DEBUG EMAIL] Redirect post-OTP (vers dashboard):       ', dashboardUrl);
  console.log('[DEBUG EMAIL] Domaine:', base, '| Locale:', locale, '\n');
}

/** Connexion magic link — envoi Resend (generateLink côté API, pas SMTP Supabase). */
export function logMagicLinkLoginUrls(
  email: string,
  locale: string,
  redirectTo: string,
  actionLink?: string
): void {
  if (!DEBUG) return;
  const base = getBaseUrl();
  console.log('\n[DEBUG EMAIL] --- Magic link login (Resend) ---');
  console.log('[DEBUG EMAIL] email:', email, '| locale:', locale);
  console.log('[DEBUG EMAIL] redirectTo (generateLink):', redirectTo);
  if (actionLink) {
    console.log('[DEBUG EMAIL] action_link (corps Resend):', actionLink);
  }
  console.log('[DEBUG EMAIL] Domaine:', base, '\n');
}

export function logWelcomeUrls(email: string, locale: string): void {
  if (!DEBUG) return;
  const base = getBaseUrl();
  const loginUrl = `${base}/${locale}/dashboard`;
  console.log('\n[DEBUG EMAIL] --- Welcome Email ---');
  console.log('[DEBUG EMAIL] loginUrl (CTA "Accéder à mon dashboard"): ', loginUrl);
  console.log('[DEBUG EMAIL] Domaine:', base, '| Locale:', locale, '\n');
}
