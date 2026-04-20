import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * PATCH /api/suggestions/private-feedback/resolve-bulk
 * Marque plusieurs retours comme traités (ex: toute une thématique).
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string') : [];
    if (ids.length === 0) {
      return apiJsonError(request, 'errors.idsRequired', 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const { error } = await supabase
      .from('private_feedback')
      .update({ resolved: true })
      .in('id', ids)
      .eq('user_id', user.id);

    if (error) {
      return apiJsonError(request, 'badRequest', 400);
    }

    return NextResponse.json({ ok: true, resolved: ids.length });
  } catch (e) {
    console.error('[suggestions/private-feedback/resolve-bulk]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
