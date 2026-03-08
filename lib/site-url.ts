/**
 * URL de base du site pour redirections (OAuth, Stripe, emails).
 * Privilégie NEXT_PUBLIC_SITE_URL pour Vercel/production.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'http://localhost:3000';
}
