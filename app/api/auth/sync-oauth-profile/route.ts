import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAuthRateLimit } from '@/lib/rate-limit';

/**
 * Synchronise le profil avec les métadonnées OAuth (Google) si les champs sont vides.
 * Appelé après une connexion Google pour compléter full_name, avatar_url, email.
 */
export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ ok: true });

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, avatar_url, email')
      .eq('id', user.id)
      .single();

    const meta = user.user_metadata ?? {};
    const updates: Record<string, string> = {};
    if (!profile?.full_name?.trim() && (meta.full_name || meta.name)) {
      updates.full_name = String(meta.full_name ?? meta.name ?? '').trim();
    }
    if (!profile?.avatar_url?.trim() && (meta.avatar_url || meta.picture)) {
      updates.avatar_url = String(meta.avatar_url ?? meta.picture ?? '').trim();
    }
    if (!profile?.email?.trim() && user.email) {
      updates.email = user.email;
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

    await admin.from('profiles').update(updates).eq('id', user.id);
    return NextResponse.json({ ok: true, updated: Object.keys(updates) });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
