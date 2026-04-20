import { checkPlan, toPlanSlug } from '@/lib/feature-gate';

/**
 * Défi REPUTEXA (dashboard, API, appendices WhatsApp, tableau public) : Zénith uniquement,
 * selon la souscription Stripe effective — aligné sur `dashboard/layout` (subscription_plan).
 */
export function canAccessReputexaChallenge(subscriptionPlan: string | null | undefined): boolean {
  const slug = toPlanSlug(subscriptionPlan ?? null, null);
  return checkPlan(slug, 'zenith');
}
