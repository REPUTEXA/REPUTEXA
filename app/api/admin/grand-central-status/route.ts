import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { parseGrandCentralAllowedIps } from '@/lib/admin/grand-central-ip';
import { GRAND_CENTRAL_BIND_COOKIE } from '@/lib/admin/grand-central-bind';
import type { GrandCentralStatusPayload } from '@/lib/admin/grand-central-status';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

/**
 * GET — Grand Central fortress status (no secrets or IPs exposed). Admin only.
 */
export async function GET() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const ipFilterActive = parseGrandCentralAllowedIps().length > 0;
  const bindSecretConfigured = Boolean(process.env.GRAND_CENTRAL_BIND_SECRET?.trim());
  const cookieStore = await cookies();
  const hasBindCookie = Boolean(cookieStore.get(GRAND_CENTRAL_BIND_COOKIE)?.value);
  const browserBindActive = bindSecretConfigured && hasBindCookie;
  const gatewayReady = Boolean(process.env.GRAND_CENTRAL_ALERT_SECRET?.trim());

  const payload: GrandCentralStatusPayload = {
    ipFilterActive,
    browserBindActive,
    gatewayReady,
  };
  return NextResponse.json(payload);
}
