import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runIaForgeAnalysis } from '@/lib/admin/ia-forge-analyze';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });

  const raw = await request.json().catch(() => ({}));
  const depth = raw.depth === 'deep' ? 'deep' : 'batch';
  const extraCorpus = typeof raw.extraCorpus === 'string' ? raw.extraCorpus : undefined;

  try {
    const result = await runIaForgeAnalysis(admin, { depth, extraCorpus });
    return NextResponse.json({
      ok: true,
      depth,
      insertedSnippets: result.insertedSnippets,
      crossLearnInserted: result.crossInserted,
    });
  } catch (e) {
    console.error('[admin/ia-forge/analyze]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('iaForgeAnalyzeFailed') },
      { status: 500 }
    );
  }
}
