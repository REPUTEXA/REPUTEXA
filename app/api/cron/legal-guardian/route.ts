/**
 * POST /api/cron/legal-guardian
 * Planification recommandée : hebdomadaire (Vercel Cron — toutes les 7 jours).
 * Recherche Tavily + double validation Claude / GPT-4o, brouillon admin + email.
 */

import { NextResponse } from 'next/server';
import { runLegalGuardian } from '@/lib/legal/guardian-run';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function checkAuth(request: Request): boolean {
  return !!(CRON_SECRET && request.headers.get('authorization') === `Bearer ${CRON_SECRET}`);
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const result = await runLegalGuardian();
  return NextResponse.json(result);
}

/** GET — même auth que POST (compatibilité Vercel Cron). */
export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const result = await runLegalGuardian();
  return NextResponse.json(result);
}
