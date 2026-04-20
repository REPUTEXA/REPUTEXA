/** Champs profil nécessaires pour la même logique d’accès que le dashboard (hors essai expiré, etc.). */
export type MerchantPaywallProfile = {
  subscription_status: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  subscription_period_end?: string | null;
  /** Comptes salariés (`/staff`) : pas de paywall marchand. */
  role?: string | null;
};

/** Si true → rediriger vers /[locale]/upgrade (aligné sur `dashboard/layout.tsx`). */
export function merchantShouldSeeUpgrade(
  profile: MerchantPaywallProfile,
  now = new Date()
): boolean {
  if (profile.role === 'merchant_staff') return false;
  const trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const periodEnd = profile.subscription_period_end
    ? new Date(profile.subscription_period_end as string)
    : null;
  const status = profile.subscription_status;
  const periodEndPassed = periodEnd && now >= periodEnd;
  const accountAge = profile.trial_started_at
    ? now.getTime() - new Date(profile.trial_started_at).getTime()
    : Infinity;
  const isNewAccountGrace = status === 'pending' && accountAge < 10 * 60 * 1000;

  if (periodEndPassed) return true;
  if (
    status !== 'trialing' &&
    status !== 'active' &&
    status !== 'past_due' &&
    !isNewAccountGrace
  ) {
    return true;
  }
  if (status === 'trialing' && trialEnd && now >= trialEnd) return true;
  return false;
}
