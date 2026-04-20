import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateScheduledAt, POSITIVE_THRESHOLD } from '@/lib/reviews/queue';
import { apiJsonError } from '@/lib/api/api-error-response';

type Action = 'publish_now' | 'cancel' | 'edit';

/**
 * Actions sur une review : Publier maintenant, Annuler, Modifier la réponse
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, responseText } = body as { action?: Action; responseText?: string };

    if (!action || !['publish_now', 'cancel', 'edit'].includes(action)) {
      return apiJsonError(request, 'errors.supabase_invalidReviewAction', 400);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const updates: Record<string, unknown> = {};

    if (action === 'publish_now') {
      const { data: review } = await supabase
        .from('reviews')
        .select('ai_response, response_text, rating, status')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!review) return apiJsonError(request, 'errors.reviewNotFound', 404);
      const text = review.response_text || review.ai_response;
      if (!text) return apiJsonError(request, 'errors.noReplyToPublish', 400);
      updates.response_text = text;
      updates.ai_response = text;

      const rating = typeof review.rating === 'number' ? review.rating : POSITIVE_THRESHOLD;
      const st = String(review.status ?? '');
      const alreadyInPublicationQueue =
        st === 'pending_publication' || st === 'scheduled' || st === 'generating';

      if (alreadyInPublicationQueue) {
        /* File existante : « Publier maintenant » saute le délai human-like */
        updates.status = 'published';
        updates.scheduled_at = null;
      } else if (rating < POSITIVE_THRESHOLD) {
        /* Premier envoi d'un avis négatif : délai human-like comme les avis positifs */
        updates.status = 'pending_publication';
        updates.scheduled_at = calculateScheduledAt().toISOString();
      } else {
        updates.status = 'published';
        updates.scheduled_at = null;
      }
    } else if (action === 'cancel') {
      updates.status = 'pending';
      updates.scheduled_at = null;
    } else if (action === 'edit' && typeof responseText === 'string' && responseText.trim()) {
      updates.ai_response = responseText.trim();
      updates.response_text = responseText.trim();
      // reste en scheduled ou pending selon l'état actuel
    } else if (action === 'edit') {
      return apiJsonError(request, 'errors.supabase_responseTextRequiredForEdit', 400);
    }

    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, status, scheduled_at')
      .single();

    if (error) return apiJsonError(request, 'serverError', 400);
    if (!data) return apiJsonError(request, 'errors.reviewNotFound', 404);

    return NextResponse.json({ success: true, ...data });
  } catch {
    return apiJsonError(request, 'serverError', 500);
  }
}
