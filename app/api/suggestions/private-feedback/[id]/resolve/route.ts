import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * PATCH /api/suggestions/private-feedback/[id]/resolve
 * Marque un retour client comme traité.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return apiJsonError(request, 'badRequest', 400);
    }

    return NextResponse.json({ ok: true, resolved: true });
  } catch (e) {
    console.error('[suggestions/private-feedback/resolve]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
