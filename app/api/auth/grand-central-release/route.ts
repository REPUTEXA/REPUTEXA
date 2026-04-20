import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clearGrandCentralCookies } from '@/lib/admin/grand-central-cookies';

export const dynamic = 'force-dynamic';

/**
 * Déconnexion forcée lorsque la liaison navigateur (Grand Central) ne correspond plus.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = request.cookies.get('NEXT_LOCALE')?.value ?? 'fr';
  const login = new URL(`/${locale}/login`, request.url);
  login.searchParams.set('message', 'grand-central-bind');

  const res = NextResponse.redirect(login);
  clearGrandCentralCookies(res);
  return res;
}
