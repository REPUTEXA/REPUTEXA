import type { SupabaseClient } from '@supabase/supabase-js';

/** Recalcule priority_score sur public.profiles + clichés pic + série du jour (RPC SQL). */
export async function refreshClientPriorityScores(admin: SupabaseClient): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.rpc('compute_priority_score');
  if (error) {
    console.error('[refreshClientPriorityScores]', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
