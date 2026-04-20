import type { SupabaseClient } from '@supabase/supabase-js';
import { sha256Hex } from '@/lib/banano/ghost-agent-token';

export async function resolveGhostAgentMerchantId(
  supabase: SupabaseClient,
  bearerToken: string
): Promise<string | null> {
  const t = bearerToken.trim();
  if (t.length < 16) return null;
  const hash = sha256Hex(t);
  const { data, error } = await supabase
    .from('banano_ghost_agent_tokens')
    .select('id, user_id')
    .eq('token_sha256', hash)
    .is('revoked_at', null)
    .maybeSingle();

  if (error || !data?.user_id) return null;

  await supabase
    .from('banano_ghost_agent_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', (data as { id: string }).id);

  return String((data as { user_id: string }).user_id);
}
