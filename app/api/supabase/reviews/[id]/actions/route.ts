import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      return NextResponse.json({ error: 'action invalide' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const updates: Record<string, unknown> = {};

    if (action === 'publish_now') {
      const { data: review } = await supabase
        .from('reviews')
        .select('ai_response, response_text')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      const text = review.response_text || review.ai_response;
      if (!text) return NextResponse.json({ error: 'Aucune réponse à publier' }, { status: 400 });
      updates.response_text = text;
      updates.ai_response = text;
      updates.status = 'published';
      updates.scheduled_at = null;
    } else if (action === 'cancel') {
      updates.status = 'pending';
      updates.scheduled_at = null;
    } else if (action === 'edit' && typeof responseText === 'string' && responseText.trim()) {
      updates.ai_response = responseText.trim();
      updates.response_text = responseText.trim();
      // reste en scheduled ou pending selon l'état actuel
    } else if (action === 'edit') {
      return NextResponse.json({ error: 'responseText requis pour edit' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, status, scheduled_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}
