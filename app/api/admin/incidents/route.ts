/**
 * GET /api/admin/incidents?limit=50
 * Derniers incidents système. Accès admin uniquement.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });

  const { data, error } = await admin
    .from('system_incidents')
    .select('id, service, status, message, latency_ms, auto_fixed, alert_sent, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ incidents: data ?? [] });
}
