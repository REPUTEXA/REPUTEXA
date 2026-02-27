import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const VALID_LOCALES = [...routing.locales];

// Routes publiques (pas d'auth requise)
const isPublicRoute = createRouteMatcher([
  '/',
  '/en',
  '/fr',
  '/es',
  '/de',
  '/ja',
  '/:locale/sign-up(.*)',
  '/:locale/sign-in(.*)',
  '/sign-up(.*)',
  '/sign-in(.*)',
]);

/**
 * 1. Routes /api → passer directement (pas de next-intl, pas d'auth)
 * 2. Magic link ?lang=es → redirect
 * 3. Clerk auth pour /dashboard et /checkout
 * 4. next-intl pour les locales (pages)
 */
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  // Routes API : passer sans toucher (évite 404 et conflits next-intl)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

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
    return NextResponse.redirect(url);
  }

  // Protéger dashboard et checkout (pages)
  if (!isPublicRoute(request)) {
    const locale = VALID_LOCALES.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? 'fr';
    await auth.protect({ unauthenticatedUrl: `/${locale}/sign-in` });
  }

  return intlMiddleware(request);
});

export const config = {
  // Inclure /api pour que Clerk passe la requête (on la forward immédiatement)
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
