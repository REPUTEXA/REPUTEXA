import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { IaForgeAgentKey } from '@/lib/admin/ia-forge';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

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
  const action = raw.action as string | undefined;

  try {
    if (action === 'seed') {
      const { data: pendingIds } = await admin
        .from('ia_forge_rlhf_queue')
        .select('meta')
        .eq('status', 'pending');
      const usedReviewIds = new Set<string>();
      for (const row of pendingIds ?? []) {
        const id = (row.meta as { review_id?: string } | null)?.review_id;
        if (id) usedReviewIds.add(id);
      }

      const { data: reviews, error: revErr } = await admin
        .from('reviews')
        .select('id, comment, rating, ai_response')
        .lte('rating', 2)
        .not('ai_response', 'is', null)
        .order('created_at', { ascending: false })
        .limit(25);

      if (revErr) throw new Error(revErr.message);

      let inserted = 0;
      for (const r of reviews ?? []) {
        const id = r.id as string;
        if (usedReviewIds.has(id)) continue;
        const comment = String(r.comment ?? '').slice(0, 800);
        const draft = String(r.ai_response ?? '').slice(0, 1200);
        const { error: insErr } = await admin.from('ia_forge_rlhf_queue').insert({
          agent_key: 'reputexa_core',
          title: ta('rlhfSeedReviewTitle', { rating: r.rating }),
          context_text: comment,
          ai_draft: draft,
          status: 'pending',
          meta: { review_id: id },
        });
        if (!insErr) {
          inserted += 1;
          usedReviewIds.add(id);
        }
        if (inserted >= 10) break;
      }

      return NextResponse.json({ ok: true, inserted });
    }

    if (action === 'validate') {
      const id = raw.id as string | undefined;
      if (!id) return NextResponse.json({ error: ta('rlhfIdRequired') }, { status: 400 });

      const { data: row, error: fetchErr } = await admin
        .from('ia_forge_rlhf_queue')
        .select('id, agent_key, title, ai_draft')
        .eq('id', id)
        .eq('status', 'pending')
        .maybeSingle();

      if (fetchErr) throw new Error(fetchErr.message);
      if (!row) return NextResponse.json({ error: ta('rlhfItemNotFound') }, { status: 404 });

      const now = new Date().toISOString();
      const { error: upErr } = await admin
        .from('ia_forge_rlhf_queue')
        .update({ status: 'validated', resolved_at: now })
        .eq('id', id);
      if (upErr) throw new Error(upErr.message);

      await admin.from('ia_forge_snippet').insert({
        agent_key: row.agent_key as IaForgeAgentKey,
        body: ta('rlhfSnippetValidateBody', { extract: String(row.ai_draft).slice(0, 400) }),
        source: 'rlhf',
      });

      return NextResponse.json({ ok: true });
    }

    if (action === 'correct') {
      const id = raw.id as string | undefined;
      const correction = typeof raw.correction === 'string' ? raw.correction.trim() : '';
      if (!id || correction.length < 8) {
        return NextResponse.json({ error: ta('rlhfIdCorrectionRequired') }, { status: 400 });
      }

      const { data: row, error: fetchErr } = await admin
        .from('ia_forge_rlhf_queue')
        .select('id, agent_key, ai_draft')
        .eq('id', id)
        .eq('status', 'pending')
        .maybeSingle();

      if (fetchErr) throw new Error(fetchErr.message);
      if (!row) return NextResponse.json({ error: ta('rlhfItemNotFound') }, { status: 404 });

      const now = new Date().toISOString();
      const { error: upErr } = await admin
        .from('ia_forge_rlhf_queue')
        .update({
          status: 'corrected',
          admin_correction: correction,
          resolved_at: now,
        })
        .eq('id', id);
      if (upErr) throw new Error(upErr.message);

      await admin.from('ia_forge_snippet').insert({
        agent_key: row.agent_key as IaForgeAgentKey,
        body: `RLHF correction admin (remplace la proposition IA) : ${correction.slice(0, 2800)}`,
        source: 'rlhf',
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: ta('rlhfUnknownAction') }, { status: 400 });
  } catch (e) {
    console.error('[admin/ia-forge/rlhf]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('rlhfOperationFailed') },
      { status: 500 }
    );
  }
}
