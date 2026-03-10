import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/app-suggestions/[id]/upvote
 * Upvote ou retire un upvote (toggle).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from('app_suggestion_upvotes')
    .select('id')
    .eq('suggestion_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('app_suggestion_upvotes')
      .delete()
      .eq('suggestion_id', id)
      .eq('user_id', user.id);
    const { count } = await supabase
      .from('app_suggestion_upvotes')
      .select('*', { count: 'exact', head: true })
      .eq('suggestion_id', id);
    await supabase
      .from('app_suggestions')
      .update({ upvotes_count: count ?? 0 })
      .eq('id', id);
    return NextResponse.json({ upvoted: false, upvotes_count: count ?? 0 });
  }

  const { error } = await supabase.from('app_suggestion_upvotes').insert({
    suggestion_id: id,
    user_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { count } = await supabase
    .from('app_suggestion_upvotes')
    .select('*', { count: 'exact', head: true })
    .eq('suggestion_id', id);
  const newCount = count ?? 1;
  await supabase
    .from('app_suggestions')
    .update({ upvotes_count: newCount })
    .eq('id', id);

  return NextResponse.json({ upvoted: true, upvotes_count: newCount });
}
