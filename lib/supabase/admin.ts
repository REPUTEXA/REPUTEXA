import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase avec la clé service role (bypass RLS).
 * Utilisé uniquement côté serveur pour des vérifications comme l'éligibilité à l'essai.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
