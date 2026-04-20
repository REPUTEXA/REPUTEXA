/**
 * GET /api/admin/perf-probe?budget=500
 * DB latency probe + mini burst — admins only.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAdminPerfProbe } from '@/lib/admin/perf-probe';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

export async function GET(request: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const raw = parseInt(searchParams.get('budget') ?? '500', 10);
  const budget = Number.isFinite(raw) ? Math.min(5000, Math.max(50, raw)) : 500;

  try {
    const payload = await runAdminPerfProbe(budget);
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('perfProbeFailed') },
      { status: 500 }
    );
  }
}
