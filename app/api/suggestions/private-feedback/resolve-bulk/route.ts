import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/suggestions/private-feedback/resolve-bulk
 * Marque plusieurs retours comme traités (ex: toute une thématique).
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string') : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids requis' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('private_feedback')
      .update({ resolved: true })
      .in('id', ids)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, resolved: ids.length });
  } catch (e) {
    console.error('[suggestions/private-feedback/resolve-bulk]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
