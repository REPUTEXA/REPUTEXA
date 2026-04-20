/**
 * POST /api/profile/feature-release-seen
 * Marque un communiqué app_updates comme « vu » pour la modale Nouveautés du dashboard.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  let body: { updateId?: string };
  try {
    body = (await request.json()) as { updateId?: string };
  } catch {
    return apiJsonError(request, 'invalidJson', 400);
  }

  const updateId = typeof body.updateId === 'string' ? body.updateId.trim() : '';
  if (!updateId || !/^[0-9a-f-]{36}$/i.test(updateId)) {
    return apiJsonError(request, 'errors.updateIdInvalid', 400);
  }

  const { data: row, error: selErr } = await supabase
    .from('app_updates')
    .select('id, publish_at')
    .eq('id', updateId)
    .maybeSingle();

  if (selErr || !row) {
    return apiJsonError(request, 'errors.releaseNotFound', 404);
  }

  const pub = row.publish_at != null ? new Date(row.publish_at as string).getTime() : 0;
  if (!Number.isFinite(pub) || pub > Date.now()) {
    return apiJsonError(request, 'errors.releaseNotPublished', 400);
  }

  const { error: upErr } = await supabase
    .from('profiles')
    .update({ last_seen_feature_release_id: updateId })
    .eq('id', user.id);

  if (upErr) {
    console.error('[feature-release-seen]', upErr);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({ ok: true });
}
