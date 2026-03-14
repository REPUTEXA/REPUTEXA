import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Cron : publie les réponses en attente dont scheduled_at <= now().
 * S'exécute toutes les 15 min — délai human-like 2h–8h après création.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: toPublish, error } = await supabase
    .from('reviews')
    .select('id, ai_response, response_text')
    .in('status', ['scheduled', 'pending_publication'])
    .lte('scheduled_at', now)
    .not('scheduled_at', 'is', null);

  if (error) {
    console.error('[cron/publish-scheduled-reviews]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!toPublish?.length) {
    return NextResponse.json({ published: 0 });
  }

  let published = 0;
  for (const r of toPublish) {
    const text = r.response_text || r.ai_response;
    if (!text) continue;
    const { error: upErr } = await supabase
      .from('reviews')
      .update({
        response_text: text,
        ai_response: text,
        status: 'published',
        scheduled_at: null,
      })
      .eq('id', r.id);
    if (!upErr) published++;
  }

  return NextResponse.json({ published });
}
