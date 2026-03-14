/**
 * Lecture du cookie activeLocation côté serveur (API routes, server components).
 * Le nom doit correspondre à ACTIVE_LOCATION_COOKIE dans active-location-context.
 */
const COOKIE_NAME = 'reputexa_active_location';

export function getActiveLocationIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(COOKIE_NAME + '=([^;]+)', 'i'));
  return match ? decodeURIComponent(match[1].trim()) : null;
}
