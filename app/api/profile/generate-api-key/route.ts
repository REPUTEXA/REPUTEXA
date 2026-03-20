import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/profile/generate-api-key
 *
 * Génère (ou régénère) la clé API publique du commerçant.
 * Format : rtx_live_<uuid_v4> — intégrée directement dans l'URL du webhook.
 *
 * ⚠️  La rotation révoque instantanément l'ancienne clé.
 *     Tout POS ou Zapier configuré avec l'ancienne URL doit être mis à jour.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }

  const apiKey = `rtx_live_${crypto.randomUUID()}`;

  const { error } = await admin
    .from('profiles')
    .update({ api_key: apiKey })
    .eq('id', user.id);

  if (error) {
    console.error('[generate-api-key]', error.message);
    return NextResponse.json({ error: 'Erreur lors de la génération.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, api_key: apiKey });
}
