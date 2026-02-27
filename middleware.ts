import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const VALID_LOCALES = [...routing.locales];

// Routes publiques (pas d'auth requise)
// Note: /:locale matcherait /api → on exclut explicitement /api/* sauf le webhook
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
 * 1. Magic link ?lang=es → redirect
 * 2. Clerk auth pour /dashboard et /checkout
 * 3. next-intl pour les locales
 */
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const url = request.nextUrl.clone();
  const lang = url.searchParams.get('lang') ?? url.searchParams.get('locale');

  if (lang && VALID_LOCALES.includes(lang as (typeof VALID_LOCALES)[number])) {
    url.searchParams.delete('lang');
    url.searchParams.delete('locale');
    let pathname = url.pathname;
    for (const l of VALID_LOCALES) {
      if (pathname === `/${l}`) {
        pathname = '/';
        break;
      }
      if (pathname.startsWith(`/${l}/`)) {
        pathname = '/' + pathname.slice(l.length + 2);
        break;
      }
    }
    url.pathname = pathname === '/' ? `/${lang}` : `/${lang}/${pathname.replace(/^\//, '')}`;
    return NextResponse.redirect(url);
  }

  // Protéger dashboard et checkout (pages)
  if (!isPublicRoute(request)) {
    const pathname = request.nextUrl.pathname;
    const locale = VALID_LOCALES.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? 'fr';
    await auth.protect({ unauthenticatedUrl: `/${locale}/sign-in` });
  }

  return intlMiddleware(request);
});

export const config = {
  // Exclure /api pour éviter 404 (next-intl + auth.protect)
  // Les routes API utilisent getAuth(request) au lieu de auth()
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
