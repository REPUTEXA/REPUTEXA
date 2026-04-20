import { NextRequest, NextResponse } from 'next/server';
import { notifyGrandCentralIntrusion } from '@/lib/admin/grand-central-intrusion-notify';
import { apiJsonErrorDefaultLocale } from '@/lib/api/api-error-response';

export const dynamic = 'force-dynamic';

/**
 * POST — appel interne (middleware Edge) pour journaliser / alerter sans importer la pile mail dans le middleware.
 * Auth : Bearer GRAND_CENTRAL_ALERT_SECRET
 */
export async function POST(request: NextRequest) {
  const secret = process.env.GRAND_CENTRAL_ALERT_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const auth = request.headers.get('authorization')?.trim();
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    kind?: string;
    pathname?: string;
    ip?: string | null;
    ua_tail?: string | null;
    locale?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiJsonErrorDefaultLocale('invalidJson', 400);
  }

  const kind = String(body.kind ?? 'unknown');
  const pathname = String(body.pathname ?? '');
  await notifyGrandCentralIntrusion({
    kind,
    pathname,
    ip: body.ip ?? null,
    ua_tail: body.ua_tail ?? null,
    locale: typeof body.locale === 'string' ? body.locale : undefined,
  });

  return NextResponse.json({ ok: true });
}
