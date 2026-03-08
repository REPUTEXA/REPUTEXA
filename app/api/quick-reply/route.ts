import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Lecture/modification d'une review via token (magic link, sans login).
 */
export async function GET(request: NextRequest) {
  const reviewId = request.nextUrl.searchParams.get('reviewId');
  const token = request.nextUrl.searchParams.get('token');
  if (!reviewId || !token) {
    return NextResponse.json({ error: 'reviewId et token requis' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('id, reviewer_name, rating, comment, source, ai_response, response_text, status')
    .eq('id', reviewId)
    .eq('quick_reply_token', token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    reviewer_name: data.reviewer_name,
    rating: data.rating,
    comment: data.comment,
    source: data.source,
    ai_response: data.ai_response,
    response_text: data.response_text,
    status: data.status,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { reviewId, token, responseText } = body as {
    reviewId?: string;
    token?: string;
    responseText?: string;
  };

  if (!reviewId || !token || !responseText?.trim()) {
    return NextResponse.json(
      { error: 'reviewId, token et responseText requis' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .update({
      response_text: responseText.trim(),
      ai_response: responseText.trim(),
      status: 'published',
    })
    .eq('id', reviewId)
    .eq('quick_reply_token', token)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
