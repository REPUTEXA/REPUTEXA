import type { SupabaseClient } from '@supabase/supabase-js';

/** Clé de comparaison fidélité (Omni + alignement reviews). */
export function normalizeReviewerKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Compte les mémoires google antérieures pour le même client (6 mois),
 * même périmètre établissement que le sélecteur dashboard.
 */
export async function countOmniPriorReviewerMemories(
  admin: SupabaseClient,
  params: {
    userId: string;
    /** Principal = null */
    establishmentId: string | null;
    reviewerName: string;
    sinceIso: string;
  }
): Promise<number> {
  const key = normalizeReviewerKey(params.reviewerName);
  if (!key) return 0;

  const { data, error } = await admin.rpc('omni_prior_reviewer_count', {
    filter_user_id: params.userId,
    filter_establishment_id: params.establishmentId,
    reviewer_normalized: key,
    since_ts: params.sinceIso,
  });

  if (error) {
    console.warn('[omni-synapse] omni_prior_reviewer_count:', error.message);
    return 0;
  }
  if (typeof data === 'number' && !Number.isNaN(data)) return data;
  if (data != null && typeof data === 'string') return parseInt(data, 10) || 0;
  return 0;
}
