import { NextResponse } from 'next/server';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET — Infos publiques minimales pour la page d’enrôlement (`?slug=`).
 */
export async function GET(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug')?.trim() ?? '';
  if (slug.length < 3) {
    return NextResponse.json({ error: tm('publicJoinSlugRequired') }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tm('serviceUnavailable') }, { status: 503 });
  }

  const { data, error } = await admin
    .from('profiles')
    .select('establishment_name')
    .eq('banano_terminal_public_slug', slug)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: tm('establishmentNotFound') }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    establishmentName: (data as { establishment_name?: string }).establishment_name ?? null,
  });
}
