import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  analyzeFailureAndProposePromptDelta,
  inferOutcomeFromQueueMetadata,
  mergePromptAddonIntoProfile,
} from '@/lib/omni-synapse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Worker Protocole Rétroaction — planifié 2×/jour via Vercel Cron ou équivalent.
 * Vérifie les followups J+48h et enrichit `profiles.omni_recursive_prompt_addon` si échec.
 */
export async function GET(request: Request) {
  const ta = apiAdminT();
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('supabaseAdminMissing') }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { data: pending, error: qErr } = await admin
    .from('omni_publication_followups')
    .select('id, user_id, review_queue_id, outcome')
    .lte('due_at', nowIso)
    .is('processed_at', null)
    .limit(50);

  if (qErr) {
    console.error('[cron/omni-recursive-scan]', qErr.message);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  let processed = 0;
  let promptsUpdated = 0;

  for (const row of pending ?? []) {
    const { data: queueRow } = await admin
      .from('review_queue')
      .select('id, metadata, first_name, source_info')
      .eq('id', row.review_queue_id)
      .maybeSingle();

    const { data: merchantProf } = await admin
      .from('profiles')
      .select('establishment_name, full_name')
      .eq('id', row.user_id as string)
      .maybeSingle();

    const brand =
      (merchantProf as { establishment_name?: string; full_name?: string } | null)?.establishment_name?.trim() ||
      (merchantProf as { establishment_name?: string; full_name?: string } | null)?.full_name?.trim() ||
      '';

    const metadata = (queueRow?.metadata ?? null) as Record<string, unknown> | null;
    const outcome = inferOutcomeFromQueueMetadata(metadata);

    if (outcome === 'not_published') {
      const establishmentSummary =
        [brand, queueRow?.source_info].filter(Boolean).join(' — ') || 'N/A';
      const { promptDelta, analysis } = await analyzeFailureAndProposePromptDelta({
        establishmentSummary,
        queueMetadata: metadata,
        priorOutcome: outcome,
      });
      try {
        await mergePromptAddonIntoProfile({
          supabase: admin,
          userId: row.user_id as string,
          newFragment: promptDelta,
        });
        promptsUpdated++;
      } catch (e) {
        console.error('[omni-recursive-scan] mergePromptAddon', e);
      }

      await admin
        .from('omni_publication_followups')
        .update({
          processed_at: nowIso,
          outcome,
          failure_analysis: analysis,
          prompt_delta: promptDelta,
        })
        .eq('id', row.id);
    } else {
      await admin
        .from('omni_publication_followups')
        .update({
          processed_at: nowIso,
          outcome: outcome === 'unknown' ? 'unknown' : outcome,
          failure_analysis: null,
          prompt_delta: null,
        })
        .eq('id', row.id);
    }
    processed++;
  }

  return NextResponse.json({ processed, promptsUpdated });
}
