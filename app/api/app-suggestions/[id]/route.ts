import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;

async function getAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return { user, isAdmin: profile?.role === 'admin' };
}

/**
 * PATCH /api/app-suggestions/[id]
 * Met à jour le statut d'une suggestion (admin uniquement).
 * Si status = DONE, completed_at est défini et update_content est persisté.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = createServerTranslator('ApiAppSuggestions', apiLocaleFromRequest(request));
  const supabase = await createClient();
  const { user, isAdmin } = await getAdminUser(supabase);

  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }
  if (!isAdmin) {
    return apiJsonError(request, 'forbidden', 403);
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: t('missingId') }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status as string | undefined;
  const updateContent = body.update_content as string | undefined;

  if (!status || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: t('invalidStatus') }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (status === 'DONE') {
    update.completed_at = new Date().toISOString();
    if (typeof updateContent === 'string' && updateContent.trim()) {
      update.update_content = updateContent.trim();
    }
  } else {
    update.completed_at = null;
    update.update_content = null;
  }

  const { data, error } = await supabase
    .from('app_suggestions')
    .update(update)
    .eq('id', id)
    .select('id, title, description, status, upvotes_count, created_at, completed_at, image_url, update_content')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: t('suggestionNotFound') }, { status: 404 });
  }

  return NextResponse.json({ suggestion: data });
}

/**
 * DELETE /api/app-suggestions/[id]
 * Supprime définitivement une suggestion (admin uniquement).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = createServerTranslator('ApiAppSuggestions', apiLocaleFromRequest(request));
  const supabase = await createClient();
  const { user, isAdmin } = await getAdminUser(supabase);

  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }
  if (!isAdmin) {
    return apiJsonError(request, 'forbidden', 403);
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: t('missingId') }, { status: 400 });
  }

  const { error } = await supabase.from('app_suggestions').delete().eq('id', id);

  if (error) {
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({ success: true });
}
