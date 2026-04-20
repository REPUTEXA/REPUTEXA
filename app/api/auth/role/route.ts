import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/auth/role
 * Retourne le rôle de l'utilisateur courant (null si non authentifié).
 * Utilisé côté client pour les vérifications d'accès admin légères.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ role: (data?.role as string) ?? null });
}
