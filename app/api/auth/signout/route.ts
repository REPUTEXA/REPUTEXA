import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clearGrandCentralCookies } from '@/lib/admin/grand-central-cookies';

/**
 * POST /api/auth/signout
 *
 * Déconnexion serveur propre : invalide le token côté Supabase ET efface
 * tous les cookies de session dans la réponse HTTP.
 * Utilisé quand on veut garantir que le serveur ne verra plus l'ancienne session
 * à la prochaine requête, indépendamment du client JS.
 *
 * Query params :
 *   ?next=/fr/login   → URL de redirection post-signout (défaut : /login)
 */
export async function POST(_request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  // Suppression explicite des cookies Supabase (couverture maximale des noms possibles)
  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token',
    `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0]?.split('//')[1]}-auth-token`,
  ];
  for (const name of cookiesToClear) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' });
  }
  clearGrandCentralCookies(response);
  return response;
}

/** GET /api/auth/signout?next=/fr/login  → redirect après déconnexion */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { searchParams } = new URL(request.url);
  const next = searchParams.get('next') ?? '/login';

  const response = NextResponse.redirect(new URL(next, request.url));
  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token',
    `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0]?.split('//')[1]}-auth-token`,
  ];
  for (const name of cookiesToClear) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' });
  }
  clearGrandCentralCookies(response);
  return response;
}
