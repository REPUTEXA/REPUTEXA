/**
 * @deprecated Ancien récap basé sur Prisma + numéro global.
 * Le flux production est uniquement GET /api/cron/weekly-insight (Supabase, un envoi par client Pulse/Zenith).
 * Route conservée pour éviter 404 si un ancien planificateur externe la référence encore.
 */
import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ta = apiAdminT();
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    deprecated: true,
    useInstead: '/api/cron/weekly-insight',
    message: ta('weeklyRecapDeprecatedCronMessage'),
  });
}
