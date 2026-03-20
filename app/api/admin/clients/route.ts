/**
 * GET /api/admin/clients
 * Liste paginée des profils (recherche + range Supabase).
 * Réservé aux administrateurs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

/** Prépare le motif ilike et une valeur PostgREST entre guillemets (emails avec « . » inclus). */
function buildIlikeQuotedFilter(raw: string): string {
  const inner = raw.trim().replace(/"/g, '').replace(/,/g, ' ').slice(0, 120);
  const pattern = `%${inner}%`;
  return `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  let perPage = parseInt(searchParams.get('perPage') ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
  perPage = Math.min(Math.max(10, perPage), MAX_PER_PAGE);

  const qRaw = searchParams.get('q') ?? '';
  const searchActive = qRaw.trim().length > 0;
  const qQuoted = buildIlikeQuotedFilter(qRaw);

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = admin
    .from('profiles')
    .select(
      'id, full_name, establishment_name, email, phone, subscription_plan, subscription_status, created_at, role',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (searchActive) {
    query = query.or(
      `establishment_name.ilike.${qQuoted},full_name.ilike.${qQuoted},email.ilike.${qQuoted},phone.ilike.${qQuoted}`
    );
  }

  const { data: rows, error, count } = await query.range(from, to);

  if (error) {
    console.error('[admin/clients]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return NextResponse.json({
    clients: rows ?? [],
    total,
    page,
    perPage,
    totalPages,
    fromRow: total === 0 ? 0 : from + 1,
    toRow: Math.min(from + (rows?.length ?? 0), total),
  });
}
