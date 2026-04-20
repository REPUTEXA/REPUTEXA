import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Export RGPD (Art. 20) — JSON téléchargeable : profil, avis, file d’attente, blacklist, consent_logs.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(request, 'serverConfiguration', 500);
  }

  const uid = user.id;

  const [profileRes, reviewsRes, queueRes, blacklistRes, consentRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', uid).maybeSingle(),
    admin.from('reviews').select('*').eq('user_id', uid),
    admin.from('review_queue').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5000),
    admin.from('blacklist').select('*').eq('user_id', uid),
    admin.from('consent_logs').select('*').eq('merchant_id', uid).order('created_at', { ascending: false }).limit(5000),
  ]);

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user_id: uid,
    email: user.email,
    profile: profileRes.data,
    reviews: reviewsRes.data ?? [],
    review_queue: queueRes.data ?? [],
    blacklist: blacklistRes.data ?? [],
    consent_logs: consentRes.data ?? [],
  };

  const filename = `reputexa-export-${uid.slice(0, 8)}.json`;

  return NextResponse.json(exportPayload, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
