import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/profile/generate-webhook-token
 *
 * Génère (ou régénère) un webhook_token unique pour le commerçant.
 * Le token est un hex de 32 octets aléatoires (64 caractères).
 * Révoque l'ancien token — à mettre à jour dans le POS immédiatement.
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

  // Générer un token aléatoire sécurisé (crypto)
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const token = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const { error } = await admin
    .from('profiles')
    .update({ webhook_token: token })
    .eq('id', user.id);

  if (error) {
    console.error('[generate-webhook-token]', error.message);
    return NextResponse.json({ error: 'Erreur lors de la génération.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token });
}
