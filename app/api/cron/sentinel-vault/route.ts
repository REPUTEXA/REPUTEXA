/**
 * Cron Sentinel Vault — 03:00 UTC (cf. vercel.json).
 * Dump logique Postgres (public) → gzip → AES-256-GCM → S3/R2.
 * Clés dédiées BACKUP_S3_* + SENTINEL_VAULT_AES_KEY (jamais les clés app publiques).
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSentinelVaultBackup } from '@/lib/sentinel-vault/run-backup';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/** pg / fs natifs — pas Edge */
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET?.trim();

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization')?.trim();
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const bearerOk = !!(CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`);
  return bearerOk || isVercelCron;
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runBody();
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runBody();
}

async function runBody() {
  const ta = apiAdminT();
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const result = await runSentinelVaultBackup(admin);
  return NextResponse.json(result);
}
