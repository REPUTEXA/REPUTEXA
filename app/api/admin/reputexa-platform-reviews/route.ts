import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
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
 * GET — list product testimonials (all statuses), most recent first.
 */
export async function GET() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const { data, error } = await admin
    .from('reputexa_platform_reviews')
    .select(
      'id, user_id, locale, rating, body_public, display_name, role_line, country_label, status, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

type PatchBody = {
  id?: string;
  status?: 'approved' | 'rejected';
};

/**
 * PATCH — moderate a testimonial (approved | rejected).
 */
export async function PATCH(request: Request) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const raw = (await request.json().catch(() => ({}))) as PatchBody;
  const id = String(raw.id ?? '').trim();
  const status = raw.status;
  if (!id || (status !== 'approved' && status !== 'rejected')) {
    return NextResponse.json({ error: ta('reputexaPlatformReviewModerationInvalid') }, { status: 400 });
  }

  const { error } = await admin
    .from('reputexa_platform_reviews')
    .update({ status })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
