import type { SupabaseClient } from '@supabase/supabase-js';

/** Passe les bons échus en statut `expired` (appelable avant liste / validation). */
export async function expireDueBananoVouchers(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('banano_loyalty_vouchers')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'available')
    .not('expires_at', 'is', null)
    .lt('expires_at', now);
  if (error) {
    console.warn('[expireDueBananoVouchers]', error.message);
  }
}
