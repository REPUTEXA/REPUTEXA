import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCurrentPublishedLegal } from '@/lib/legal/current-published';
import { apiJsonError } from '@/lib/api/api-error-response';

type Mode = 'pre_checkout' | 'collecte_avis';

/**
 * POST /api/profile/accept-merchant-compliance
 *
 * Enregistre la validation marchand avec horodatage + version légale (audit / contrôle).
 *
 * Body JSON :
 *   { "mode": "pre_checkout" | "collecte_avis", "zenithAttested"?: boolean }
 *
 * - pre_checkout : étape confirm-email avant Stripe (CGU + option Zenith).
 * - collecte_avis : sauvegarde depuis Collecte d'avis (complète les champs conformité uniquement).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let mode: Mode = 'collecte_avis';
  let zenithAttested = false;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.mode === 'pre_checkout' || body.mode === 'collecte_avis') {
      mode = body.mode;
    }
    zenithAttested = body.zenithAttested === true;
  } catch {
    /* defaults */
  }

  const published = await fetchCurrentPublishedLegal(supabase);
  if (!published) {
    console.error('[accept-merchant-compliance] no published legal row in force');
    return apiJsonError(req, 'errors.legal_noPublishedVersionServer', 500);
  }

  const legalVersion = published.version;
  const nowIso = new Date().toISOString();

  const base: Record<string, unknown> = {
    legal_compliance_accepted: true,
    legal_compliance_accepted_at: nowIso,
    legal_compliance_accepted_legal_version: legalVersion,
    last_legal_agreement_version: legalVersion,
  };

  if (mode === 'pre_checkout') {
    base.accepted_terms = true;
    base.terms_accepted_at = nowIso;
    if (zenithAttested) {
      base.accepted_zenith_terms = true;
    }
  }

  const { error: upError } = await supabase.from('profiles').update(base).eq('id', user.id);

  if (upError) {
    console.error('[accept-merchant-compliance] update', upError);
    return apiJsonError(req, 'serverError', 500);
  }

  return NextResponse.json({
    success: true,
    legal_compliance_accepted_at: nowIso,
    legal_compliance_accepted_legal_version: legalVersion,
    mode,
  });
}
