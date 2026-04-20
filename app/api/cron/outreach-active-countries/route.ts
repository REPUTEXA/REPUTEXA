/**
 * POST/GET /api/cron/outreach-active-countries
 * Pousse les prospects vers Instantly pour chaque pays actif (campagnes configurées).
 */

import { NextRequest, NextResponse } from 'next/server';
import { runOutreachActiveCountriesCron } from '@/lib/outreach/run-outreach-cron';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function checkAuth(request: Request): boolean {
  return !!(CRON_SECRET && request.headers.get('authorization') === `Bearer ${CRON_SECRET}`);
}

export async function POST(request: NextRequest) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runCron();
}

export async function GET(request: NextRequest) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runCron();
}

async function runCron() {
  const ta = apiAdminT();
  try {
    const { ran, results } = await runOutreachActiveCountriesCron();
    return NextResponse.json({ ok: true, ran, results });
  } catch (e) {
    console.error('[cron/outreach-active-countries]', e);
    return NextResponse.json({ ok: false, error: ta('serverError') }, { status: 500 });
  }
}
