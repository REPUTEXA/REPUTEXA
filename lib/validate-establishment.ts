import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vérifie que l'établissement demandé appartient bien à l'utilisateur connecté.
 * À utiliser côté serveur (API routes, server components) pour tout filtre par establishment_id.
 *
 * @param supabase - Client Supabase déjà authentifié (user doit être présent)
 * @param establishmentId - 'profile' (principal) ou UUID d'un établissement
 * @returns L'ID validé ('profile' ou UUID) ou null si invalide / pas autorisé
 */
export async function validateEstablishmentId(
  supabase: SupabaseClient,
  establishmentId: string | null | undefined
): Promise<string | null> {
  if (!establishmentId || establishmentId.trim() === '') {
    return 'profile';
  }
  const id = establishmentId.trim();
  if (id === 'profile') {
    return 'profile';
  }
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) {
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return null;
  }
  const { data: establishment } = await supabase
    .from('establishments')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  return establishment?.id ?? null;
}
