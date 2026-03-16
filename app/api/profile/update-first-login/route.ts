/**
 * POST /api/profile/update-first-login
 * Passe first_login à false après affichage de la célébration (confettis + toast).
 * Appelé par WelcomeFlash et SuccessPaymentToast une seule fois après avoir montré l'effet.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({ first_login: false })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
