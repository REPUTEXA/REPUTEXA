import { NextResponse } from 'next/server';
import { gunzipSync } from 'zlib';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGzipArchive } from '@/lib/black-box/s3-io';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const ta = apiAdminT();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });

  const { data: row, error } = await admin
    .from('black_box_archive_index')
    .select('s3_bucket, s3_key, source_table, row_count, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: ta('blackBoxArchiveNotFound') }, { status: 404 });

  try {
    const raw = await getGzipArchive(row.s3_bucket as string, row.s3_key as string);
    const jsonText = gunzipSync(raw).toString('utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ error: ta('blackBoxPayloadJsonInvalid') }, { status: 502 });
    }
    return NextResponse.json({
      meta: {
        source_table: row.source_table,
        row_count: row.row_count,
        archived_index_at: row.created_at,
      },
      payload: parsed,
    });
  } catch (e) {
    console.error('[black-box payload]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('blackBoxS3ReadFailed') },
      { status: 502 }
    );
  }
}
