import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCurrentPublishedLegal } from '@/lib/legal/current-published';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * POST /api/profile/accept-legal
 *
 * Enregistre l'acceptation de la version légale **actuellement en vigueur** (ACTIVE + date d’effet ≤ aujourd’hui).
 *
 * Body JSON :
 *   { version: number } — doit correspondre exactement à la version publiée (sinon 409, rafraîchir la page).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let clientVersion: number;
  try {
    const body = await req.json();
    clientVersion = Number(body.version);
    if (!Number.isInteger(clientVersion) || clientVersion < 1) throw new Error('invalid');
  } catch {
    return apiJsonError(req, 'errors.profile_acceptLegalVersionInvalid', 400);
  }

  const published = await fetchCurrentPublishedLegal(supabase);
  if (!published) {
    return apiJsonError(req, 'errors.legal_noPublishedVersion', 409);
  }

  if (clientVersion !== published.version) {
    return apiJsonError(req, 'errors.legal_versionChangedRefresh', 409);
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      last_legal_agreement_version: published.version,
      legal_compliance_accepted_at: nowIso,
      legal_compliance_accepted_legal_version: published.version,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[accept-legal]', error);
    return apiJsonError(req, 'serverError', 500);
  }

  return NextResponse.json({
    success: true,
    version: published.version,
    legal_compliance_accepted_at: nowIso,
  });
}
