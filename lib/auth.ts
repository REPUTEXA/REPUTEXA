import { createClient } from '@/lib/supabase/server';

/**
 * Récupère l'utilisateur Supabase courant (auth unifiée Supabase).
 * Pour compatibilité si des routes utilisent getOrCreateUser.
 */
export async function getOrCreateUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
