import type { SupabaseClient } from '@supabase/supabase-js';

export type LoyaltyIdempotencyScope = 'transact' | 'voucher_redeem';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLoyaltyIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!UUID_RE.test(s)) return null;
  return s.toLowerCase();
}

export async function readLoyaltyIdempotentJson(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('banano_loyalty_transact_idempotency')
    .select('response_json')
    .eq('id', idempotencyKey)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[loyalty-idempotency read]', error.message);
    return null;
  }
  const j = data?.response_json;
  if (j && typeof j === 'object' && !Array.isArray(j)) {
    return j as Record<string, unknown>;
  }
  return null;
}

export async function saveLoyaltyIdempotentJson(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string,
  scope: LoyaltyIdempotencyScope,
  response: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('banano_loyalty_transact_idempotency').insert({
    id: idempotencyKey,
    user_id: userId,
    scope,
    response_json: response,
  });
  if (error?.code === '23505') {
    return;
  }
  if (error) {
    console.warn('[loyalty-idempotency save]', error.message);
  }
}

/** Statuts HTTP pour lesquels un rejeu côté terminal est pertinent (erreur serveur / réseau). */
export function shouldRetryTerminalFetch(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
