import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;

/**
 * PATCH /api/app-suggestions/[id]
 * Met à jour le statut d'une suggestion. Si status = DONE, completed_at est défini.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status as string | undefined;
  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: 'Statut invalide (PENDING, IN_PROGRESS, DONE)' }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (status === 'DONE') {
    update.completed_at = new Date().toISOString();
  } else {
    update.completed_at = null;
  }

  const { data, error } = await supabase
    .from('app_suggestions')
    .update(update)
    .eq('id', id)
    .select('id, title, description, status, upvotes_count, created_at, completed_at, image_url')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Suggestion introuvable' }, { status: 404 });
  }

  return NextResponse.json({ suggestion: data });
}
