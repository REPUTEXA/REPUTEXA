import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DEFAULT_RETENTION_DAYS = 30;

function authCron(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return !!(process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`);
}

function retentionDays(): number {
  const raw = process.env.BANANO_IDEMPOTENCY_RETENTION_DAYS;
  if (raw == null || raw.trim() === '') return DEFAULT_RETENTION_DAYS;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 7 || n > 365) return DEFAULT_RETENTION_DAYS;
  return n;
}

/**
 * Supprime les entrées d’idempotence trop anciennes (défaut 30 jours).
 * Au-delà, un client très ancien pourrait théoriquement rejouer une même clé
 * après rotation — risque négligeable pour le terminal réel.
 */
export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!authCron(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const days = retentionDays();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const { error, count } = await admin
    .from('banano_loyalty_transact_idempotency')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (error) {
    console.error('[cron banano-loyalty-idempotency-prune]', error.message);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: count ?? 0,
    retentionDays: days,
    cutoff,
  });
}
