/**
 * REPUTEXA Shield — Cron de sweep toxicité
 *
 * Filet de sécurité : ré-analyse les avis récents qui n'ont pas encore passé
 * le pipeline Shield (toxicity_analyzed_at IS NULL).
 * Cas typiques couverts :
 *   - Avis ingérés via webhook AVANT la mise à jour de processBadReview
 *   - Avis dont l'analyse IA a échoué lors de l'ingestion (API timeout, etc.)
 *
 * Planification recommandée : toutes les heures (cron: "0 * * * *")
 * Authentification : header Authorization: Bearer CRON_SECRET
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectToxicity } from '@/lib/shield/detect-toxicity';

const MAX_PER_RUN = 20; // Rate-limit to avoid OpenAI burst
const LOOKBACK_HOURS = 72; // Only sweep last 72h (avoid reprocessing old data)

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Business',
  facebook: 'Facebook',
  trustpilot: 'Trustpilot',
};

export async function GET(request: Request) {
  const ta = apiAdminT();
  // Auth check
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  // Fetch unanalyzed reviews
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, comment, source, user_id')
    .is('toxicity_analyzed_at', null)
    .gte('created_at', since)
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[cron/toxicity-sweep] DB query failed:', error);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ processed: 0, message: ta('toxicitySweepNothingToSweep') });
  }

  let processed = 0;
  let flagged = 0;
  const errors: string[] = [];

  for (const review of reviews) {
    try {
      const platformLabel = PLATFORM_LABELS[review.source ?? ''] ?? review.source ?? 'Inconnue';
      const toxicity = await detectToxicity(review.comment ?? '', platformLabel);
      const now = new Date().toISOString();

      await supabase
        .from('reviews')
        .update({
          is_toxic: toxicity.isToxic,
          toxicity_reason: toxicity.reason,
          toxicity_complaint_text: toxicity.complaintText,
          toxicity_legal_argumentation: toxicity.legalArgumentation,
          toxicity_created_at: toxicity.isToxic ? now : null,
          toxicity_analyzed_at: now,
        })
        .eq('id', review.id);

      processed++;
      if (toxicity.isToxic) {
        flagged++;
        // Dispatch a browser-visible event is not possible from cron,
        // but the dashboard will pick it up on next poll/reload.
        console.info(`[cron/toxicity-sweep] 🚨 Toxic review flagged: ${review.id} (${toxicity.reason})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`review ${review.id}: ${msg}`);
      console.error('[cron/toxicity-sweep] Error processing review', review.id, err);
    }
  }

  console.info(`[cron/toxicity-sweep] Sweep complete: ${processed} analyzed, ${flagged} flagged.`);

  return NextResponse.json({
    processed,
    flagged,
    errors: errors.length > 0 ? errors : undefined,
  });
}
