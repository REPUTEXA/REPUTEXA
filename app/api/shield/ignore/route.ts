import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * Marque un avis toxique comme "ignoré" (dismissed).
 * Le retire de la vue Alertes en réglant toxicity_resolved_at.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const body = await request.json() as { reviewId?: string };
    const { reviewId } = body;
    if (!reviewId) {
      return apiJsonError(request, 'errors.reviewIdRequired', 400);
    }

    const { error } = await supabase
      .from('reviews')
      .update({ toxicity_resolved_at: new Date().toISOString() })
      .eq('id', reviewId)
      .eq('user_id', user.id);

    if (error) {
      return apiJsonError(request, 'serverError', 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[shield/ignore]', error);
    return apiJsonError(request, 'serverError', 500);
  }
}
