import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Public trust signal: last Guardian cycle status (no sensitive payload).
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, certified: false, lastCheck: null as string | null },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from('legal_guardian_state')
    .select('last_run_at, last_status')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, certified: false, lastCheck: null as string | null },
      { headers: { 'Cache-Control': 'public, s-maxage=60' } }
    );
  }

  const lastStatus = typeof data.last_status === 'string' ? data.last_status : '';
  const certified = lastStatus === 'ok';
  const lastCheck = typeof data.last_run_at === 'string' ? data.last_run_at : null;

  return NextResponse.json(
    { ok: true, certified, lastStatus, lastCheck },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
  );
}
