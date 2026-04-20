import { createAdminClient } from '@/lib/supabase/admin';

export type ReputexaPlatformReviewCard = {
  id: string;
  quote: string;
  name: string;
  flag: string;
  country: string;
  role: string;
};

/**
 * Témoignages approuvés pour le carrousel d’accueil (texte déjà dans la langue soumise par l’utilisateur).
 */
export async function getApprovedReputexaPlatformReviewsForLanding(): Promise<
  ReputexaPlatformReviewCard[]
> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from('reputexa_platform_reviews')
    .select(
      'id, body_public, display_name, role_line, country_label, flag_emoji, created_at',
    )
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data?.length) return [];

  return data.map((row) => ({
    id: String(row.id),
    quote: String(row.body_public ?? '').trim(),
    name: String(row.display_name ?? '').trim() || '—',
    flag: String(row.flag_emoji ?? '').trim() || '🌍',
    country: String(row.country_label ?? '').trim() || '—',
    role: String(row.role_line ?? '').trim() || '—',
  }));
}
