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

export function logForgotPasswordUrls(
  email: string,
  locale: string,
  actionLink?: string
): void {
  if (!DEBUG) return;
  const base = getBaseUrl();
  const callbackUrl = `${base}/${locale}/auth/callback?next=/reset-password`;
  console.log('\n[DEBUG EMAIL] --- Forgot Password ---');
  console.log('[DEBUG EMAIL] redirectTo (injecté dans generateLink):   ', callbackUrl);
  if (actionLink) {
    console.log('[DEBUG EMAIL] action_link (Supabase, envoyé par Resend):', actionLink);
    console.log('[DEBUG EMAIL] → Clic user → Supabase valide → redirect vers:', callbackUrl);
  } else {
    console.log('[DEBUG EMAIL] action_link: (non disponible en mode simulation)');
  }
  console.log('[DEBUG EMAIL] Domaine:', base, '| Locale:', locale, '\n');
}

export function logWelcomeUrls(email: string, locale: string): void {
  if (!DEBUG) return;
  const base = getBaseUrl();
  const loginUrl = `${base}/${locale}/dashboard`;
  console.log('\n[DEBUG EMAIL] --- Welcome Email ---');
  console.log('[DEBUG EMAIL] loginUrl (CTA "Accéder à mon dashboard"): ', loginUrl);
  console.log('[DEBUG EMAIL] Domaine:', base, '| Locale:', locale, '\n');
}
