import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';

export type GhostAgentTokenRow = {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

/**
 * GET — Liste des jetons Agent Ghost du commerçant (jamais le secret ; hash uniquement en base).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data, error } = await supabase
    .from('banano_ghost_agent_tokens')
    .select('id, label, created_at, last_used_at, revoked_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ghost/agent-tokens]', error.message);
    return apiJsonError(request, 'errors.crm_readFailed', 500);
  }

  return NextResponse.json({ tokens: (data ?? []) as GhostAgentTokenRow[] });
}
