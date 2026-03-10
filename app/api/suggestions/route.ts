import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('suggestions')
    .select('id, title, description, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ suggestions: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();

  if (!title) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('suggestions')
    .insert({
      user_id: user.id,
      title,
      description,
      status: 'PENDING',
    })
    .select('id, title, description, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, suggestion: data });
}
