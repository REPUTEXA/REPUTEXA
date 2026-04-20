import type { SupabaseClient } from '@supabase/supabase-js';

/** Résout l’utilisateur auth salarié lié au PIN terminal, pour `processed_by_user_id` sur les événements fidélité. */
export async function loyaltyProcessedByUserId(
  supabase: SupabaseClient,
  merchantUserId: string,
  terminalStaffId: string | null | undefined
): Promise<string | null> {
  if (terminalStaffId == null || terminalStaffId === '') return null;
  if (typeof terminalStaffId !== 'string') return null;

  const { data, error } = await supabase
    .from('banano_terminal_staff')
    .select('linked_auth_user_id')
    .eq('id', terminalStaffId)
    .eq('user_id', merchantUserId)
    .maybeSingle();

  if (error || !data) return null;
  const v = (data as { linked_auth_user_id?: string | null }).linked_auth_user_id;
  return typeof v === 'string' && v.length > 0 ? v : null;
}
