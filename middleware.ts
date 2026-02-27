import createMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const VALID_LOCALES = [...routing.locales];

// Routes publiques (pas d'auth requise)
const isPublicRoute = createRouteMatcher([
  '/',
  '/:locale',
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

  // Les routes /api ne passent pas par intlMiddleware (sinon redirection → HTML au lieu de JSON)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Webhook Stripe : pas d'auth (appelé par Stripe)
    if (request.nextUrl.pathname === '/api/stripe/webhook') {
      return NextResponse.next();
    }
    if (!isPublicRoute(request)) {
      await auth.protect({ unauthenticatedUrl: '/fr/sign-in' });
    }
    return NextResponse.next();
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
  // Inclure /api pour que clerkMiddleware s'exécute (requis pour auth() dans les API routes)
  // Exclure uniquement _next, _vercel et les fichiers statiques
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
