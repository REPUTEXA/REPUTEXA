import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

const VALID_LOCALES = [...routing.locales];

/**
 * Routes publiques (pas d'auth requise).
 * Toutes les autres routes (ex: /dashboard, /dashboard/*, /checkout, /upgrade)
 * exigent une session Supabase active ; sinon redirection vers /login.
 */
const PUBLIC_PATTERNS = [
  /^\/?$/,
  /^\/(fr|en|es|de|it)(\/?)$/,
  /^\/(fr|en|es|de|it)\/sign-up(\/.*)?$/,
  /^\/(fr|en|es|de|it)\/sign-in(\/.*)?$/,
  /^\/(fr|en|es|de|it)\/login$/,
  /^\/(fr|en|es|de|it)\/signup$/,
  /^\/(fr|en|es|de|it)\/forgot-password$/,
  /^\/(fr|en|es|de|it)\/reset-password$/,
  /^\/(fr|en|es|de|it)\/confirm-email$/,
  /^\/(fr|en|es|de|it)\/verify(\/.*)?$/,
  /^\/(fr|en|es|de|it)\/auth\/callback/,
  /^\/(fr|en|es|de|it)\/choose-plan$/,
  /^\/(fr|en|es|de|it)\/pricing$/,
  /^\/(fr|en|es|de|it)\/contact$/,
  /^\/(fr|en|es|de|it)\/legal$/,
  /^\/(fr|en|es|de|it)\/privacy$/,
  /^\/(fr|en|es|de|it)\/terms$/,
  /^\/sign-up(\/.*)?$/,
  /^\/pricing$/,
  /^\/sign-in(\/.*)?$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/confirm-email$/,
  /^\/verify(\/.*)?$/,
  /^\/auth\/callback/,
  /^\/choose-plan$/,
  /^\/(fr|en|es|de|it)\/quick-reply\/[^/]+$/, // Magic link sans login
];

function isPublicRoute(pathname: string): boolean {
  const p = pathname.replace(/^\/+/, '/');
  return PUBLIC_PATTERNS.some((re) => re.test(p));
}

/**
 * Auth Supabase uniquement (Clerk retiré pour éviter conflits).
 * 1. Routes /api → passer directement
 * 2. Magic link ?lang=... → redirect
 * 3. Routes protégées : redirection vers /login si pas de session Supabase
 */
export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const { response: supabaseResponse, user: supabaseUser, emailConfirmed } = await updateSession(request);

  const url = request.nextUrl.clone();
  const lang = url.searchParams.get('lang') ?? url.searchParams.get('locale');

  if (lang && VALID_LOCALES.includes(lang as (typeof VALID_LOCALES)[number])) {
    url.searchParams.delete('lang');
    url.searchParams.delete('locale');
    let p = url.pathname;
    for (const l of VALID_LOCALES) {
      if (p === `/${l}`) {
        p = '/';
        break;
      }
      if (p.startsWith(`/${l}/`)) {
        p = '/' + p.slice(l.length + 2);
        break;
      }
    }
    url.pathname = p === '/' ? `/${lang}` : `/${lang}/${p.replace(/^\//, '')}`;
    const response = NextResponse.redirect(url);
    response.cookies.set('NEXT_LOCALE', lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  }

  if (!isPublicRoute(pathname) && !supabaseUser) {
    const locale = VALID_LOCALES.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? 'fr';
    const nextUrl = encodeURIComponent(pathname + (request.nextUrl.search || ''));
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('next', nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  if (supabaseUser && !emailConfirmed && !isPublicRoute(pathname)) {
    const locale = VALID_LOCALES.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? 'fr';
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('message', 'confirm-email');
    return NextResponse.redirect(loginUrl);
  }

  const intlResponse = intlMiddleware(request);
  supabaseResponse.cookies.getAll().forEach((c) => {
    intlResponse.cookies.set(c.name, c.value, { path: '/' });
  });
  return intlResponse;
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
