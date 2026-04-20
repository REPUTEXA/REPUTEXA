/**
 * GET/POST /api/cron/admin-council-digest
 * Synthèse multi-agents (journal uniquement). Pas d’effets de bord métier.
 * Planification recommandée : horaire (Vercel Cron).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAdminCouncilDigestTick } from '@/lib/admin/council-digest-tick';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

function checkAuth(request: Request): boolean {
  return !!(CRON_SECRET && request.headers.get('authorization') === `Bearer ${CRON_SECRET}`);
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });
  }
  const r = await runAdminCouncilDigestTick(admin);
  if (!r.ok) {
    if (r.error) console.error('[cron/admin-council-digest]', r.error);
    return NextResponse.json({ error: ta('councilDigestTickFailed') }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: r.id });
}

export async function GET(request: Request) {
  return POST(request);
}
