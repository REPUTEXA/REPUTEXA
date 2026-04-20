/**
 * GET /api/admin/health-check
 * Test ultra-rapide (≤ 800 ms) de tous les services critiques.
 * Réservé aux administrateurs (rôle admin en DB).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAdminHealthCheckServices } from '@/lib/admin/health-check-internal';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const payload = await runAdminHealthCheckServices();
  return NextResponse.json(payload);
}
