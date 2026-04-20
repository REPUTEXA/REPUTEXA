import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { apiJsonError } from '@/lib/api/api-error-response';

/**
 * Synchronise le profil avec les métadonnées OAuth (Google) si les champs sont vides.
 * Appelé après une connexion Google pour compléter full_name, avatar_url, email.
 */
export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request);
  if (!rateLimit.ok) {
    return apiJsonError(request, 'authSync_rateLimit', 429);
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const { data: { session } } = await supabase.auth.getSession();
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ ok: true });

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, avatar_url, email, wallet_given_name, wallet_family_name')
      .eq('id', user.id)
      .single();

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const updates: Record<string, string | null> = {};
    const given =
      typeof meta.given_name === 'string'
        ? meta.given_name.trim()
        : typeof meta.first_name === 'string'
          ? meta.first_name.trim()
          : '';
    const family =
      typeof meta.family_name === 'string'
        ? meta.family_name.trim()
        : typeof meta.last_name === 'string'
          ? meta.last_name.trim()
          : '';
    if (!profile?.wallet_given_name?.trim() && given) {
      updates.wallet_given_name = given;
    }
    if (!profile?.wallet_family_name?.trim() && family) {
      updates.wallet_family_name = family;
    }
    if (!profile?.full_name?.trim() && (meta.full_name || meta.name)) {
      updates.full_name = String(meta.full_name ?? meta.name ?? '').trim();
    }
    if (!profile?.avatar_url?.trim() && (meta.avatar_url || meta.picture)) {
      updates.avatar_url = String(meta.avatar_url ?? meta.picture ?? '').trim();
    }
    if (!profile?.email?.trim() && user.email) {
      updates.email = user.email;
    }
    // Persister les tokens Google (scope business.manage, access_type=offline) pour usage API hors session
    const sessionWithProvider = session as { provider_token?: string; provider_refresh_token?: string } | null;
    if (sessionWithProvider?.provider_token) {
      updates.google_access_token = sessionWithProvider.provider_token;
      updates.google_refresh_token = sessionWithProvider.provider_refresh_token ?? null;
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

    await admin.from('profiles').update(updates).eq('id', user.id);
    return NextResponse.json({ ok: true, updated: Object.keys(updates) });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
