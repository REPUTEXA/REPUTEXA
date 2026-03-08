import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Vérifie si un établissement peut bénéficier d'un nouvel essai.
 * Bloque si le même nom d'établissement a déjà utilisé un essai.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const establishmentName = typeof body.establishmentName === 'string'
      ? body.establishmentName.trim()
      : '';

    if (!establishmentName) {
      return NextResponse.json({ eligible: true }); // Pas de blocage si vide
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ eligible: true }); // Pas de clé admin = on autorise
    }

    const { data } = await admin
      .from('profiles')
      .select('id')
      .ilike('establishment_name', establishmentName)
      .eq('has_used_trial', true)
      .limit(1);

    return NextResponse.json({
      eligible: !data || data.length === 0,
    });
  } catch {
    return NextResponse.json({ eligible: true });
  }
}
