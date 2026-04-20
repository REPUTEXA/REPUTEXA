import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchEliteTopClients } from '@/lib/banano/elite-top-clients';
import { apiJsonError } from '@/lib/api/api-error-response';

export const dynamic = 'force-dynamic';

/**
 * GET — Top fidélité pour un mois calendaire UTC (`YYYY-MM`) : CA ticket + passages + extraits de notes caisse.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const url = new URL(req.url);
  const month = (url.searchParams.get('month') ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }

  try {
    const result = await fetchEliteTopClients(supabase, user.id, month, { limit: 5 });
    return NextResponse.json({
      ok: true,
      monthKey: result.monthKey,
      fromIso: result.fromIso,
      toExclusiveIso: result.toExclusiveIso,
      rows: result.rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'invalid_month_key') {
      return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
    }
    console.error('[elite-top]', msg);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
