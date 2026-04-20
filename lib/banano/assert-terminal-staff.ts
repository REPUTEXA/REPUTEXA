import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export type LoyaltyServerTranslator = ReturnType<typeof createServerTranslator>;

/**
 * Si `staffId` est fourni, vérifie qu’il appartient au commerçant et est actif.
 * `t` : traducteur namespace racine `Loyalty` (clés `errors.*`).
 */
export async function assertTerminalStaffActive(
  supabase: SupabaseClient,
  merchantUserId: string,
  staffId: string | null | undefined,
  t: LoyaltyServerTranslator
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staffId == null || staffId === '') return { ok: true };
  if (typeof staffId !== 'string') {
    return { ok: false, error: t('errors.terminalStaffInvalidId') };
  }
  const { data, error } = await supabase
    .from('banano_terminal_staff')
    .select('id')
    .eq('id', staffId)
    .eq('user_id', merchantUserId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    console.error('[assertTerminalStaffActive]', error.message);
    return { ok: false, error: t('errors.terminalStaffCheckFailed') };
  }
  if (!data) {
    return { ok: false, error: t('errors.terminalStaffInactiveOrDisabled') };
  }
  return { ok: true };
}
