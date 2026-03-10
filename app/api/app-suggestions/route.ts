import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/app-suggestions
 * Liste des suggestions produit communautaires (app_suggestions), triées par upvotes.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('app_suggestions')
    .select('id, title, description, status, upvotes_count, created_at, user_id')
    .order('upvotes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: myUpvotes } = await supabase
    .from('app_suggestion_upvotes')
    .select('suggestion_id')
    .eq('user_id', user.id);

  const upvotedIds = new Set((myUpvotes ?? []).map((u) => u.suggestion_id));

  const items = (data ?? []).map((s) => ({
    ...s,
    user_has_upvoted: upvotedIds.has(s.id),
  }));

  return NextResponse.json({ suggestions: items });
}

/**
 * POST /api/app-suggestions
 * Crée une suggestion produit (Product Lab).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();

  if (!title) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('app_suggestions')
    .insert({
      user_id: user.id,
      title,
      description: description || '',
      status: 'PENDING',
    })
    .select('id, title, description, status, upvotes_count, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, suggestion: data });
}
