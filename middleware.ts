import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';
import {
  grandCentralUsesIpAllowlist,
  isGrandCentralIpAllowed,
  bypassGrandCentralIpForTrustedAutomation,
} from '@/lib/admin/grand-central-ip';
import { isGrandCentralAdminPagePath } from '@/lib/admin/grand-central-path';
import {
  fireGrandCentralIntrusionPing,
  shouldSkipGrandCentralIntrusionPing,
  applyGrandCentralPingDedupeCookie,
} from '@/lib/admin/grand-central-ping';
import {
  grandCentralIpBlockedPageResponse,
  grandCentralIpBlockedApiResponse,
} from '@/lib/admin/grand-central-forbidden';
import { grandCentralCookieSecure } from '@/lib/admin/grand-central-cookies';
import {
  GRAND_CENTRAL_BIND_COOKIE,
  grandCentralClientFingerprint,
  signGrandCentralBind,
} from '@/lib/admin/grand-central-bind';
import { isPublicSitePathname } from '@/lib/compliance/public-site-routes';
import { ghostShieldBlocksSearchParams } from '@/lib/admin/ghost-shield-runtime';
import { negotiateSiteLocale } from '@/lib/i18n/negotiate-site-locale';
import { nextLocaleCookieSetOptions } from '@/lib/i18n/next-locale-cookie';
import { redirectIfLocaleSegmentNonCanonical } from '@/lib/i18n/canonicalize-locale-path';

/**
 * Ce fichier s’exécute uniquement sur l’**Edge Runtime** (Vercel Edge / Next.js). Pas d’`export const runtime`
 * pour `middleware.ts` — comportement implicite documenté ci-dessous.
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 *
 * Dictionnaires i18n : chargés dans `i18n/request.ts` (RSC / getRequestConfig), pas ici.
 * Ce middleware ne fait que le routage next-intl + cookies locale ; aucun JSON `messages/*.json` n’est embarqué.
 *
 * Locale — règles utiles :
 * - **Première visite** : `next-intl` (`localeDetection`) utilise `Accept-Language` et pose `NEXT_LOCALE`.
 * - **Sans cookie** sur `/fr` ou `/fr/` : redirection explicite vers la meilleure locale négociée (alignée sur le navigateur).
 * - **Avec cookie** (langue déjà choisie) : les URLs qui commencent encore par `/fr/…` sont réécrites vers `/{cookie}/…`.
 * - **`?lang=` / `?locale=`** : forcage explicite + mise à jour du cookie.
 */
const intlMiddleware = createMiddleware(routing);

const VALID_LOCALES = [...routing.locales];

function isValidLocale(code: string | undefined | null): code is (typeof VALID_LOCALES)[number] {
  return !!code && VALID_LOCALES.includes(code as (typeof VALID_LOCALES)[number]);
}

/**
 * Désabonnement newsletter : `locale` (query) > **Accept-Language** > cookie `NEXT_LOCALE` > défaut.
 */
function pickNewsletterRedirectLocale(request: NextRequest): string {
  const qp = request.nextUrl.searchParams.get('locale')?.toLowerCase().split('-')[0];
  if (isValidLocale(qp)) return qp;
  const fromAccept = negotiateSiteLocale(request.headers.get('accept-language'));
  if (fromAccept && isValidLocale(fromAccept)) return fromAccept;
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (isValidLocale(cookieLocale)) return cookieLocale;
  return routing.defaultLocale;
}

/**
 * Routes publiques (pas d'auth requise).
 * Toutes les autres routes (ex: /dashboard, /dashboard/*, /checkout, /upgrade)
 * exigent une session Supabase active ; sinon redirection vers /login.
 */
function isPublicRoute(pathname: string): boolean {
  return isPublicSitePathname(pathname);
}

/**
 * Auth Supabase uniquement (Clerk retiré pour éviter conflits).
 * 1. Routes /api → passer directement
 * 2. Magic link ?lang=... → redirect
 * 3. Routes protégées : redirection vers /login si pas de session Supabase
 */
export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const localeCanonical = redirectIfLocaleSegmentNonCanonical(request);
  if (localeCanonical) return localeCanonical;

  /** Faute de frappe fréquente — sans ça, segment inconnu + états de rendu bizarres. */
  if (pathname.includes('/dashboard/bananu')) {
    const u = request.nextUrl.clone();
    u.pathname = pathname.replaceAll('/dashboard/bananu', '/dashboard/whatsapp-review');
    return NextResponse.redirect(u);
  }

  /** Ancienne route dashboard (bookmarks / liens externes) → module Review WhatsApp. */
  if (pathname.includes('/dashboard/banano')) {
    const u = request.nextUrl.clone();
    u.pathname = pathname.replaceAll('/dashboard/banano', '/dashboard/whatsapp-review');
    return NextResponse.redirect(u, 308);
  }

  /** Faute de frappe fréquente (`/it/dashbaord`, etc.) → `/…/dashboard`. */
  if (pathname.includes('/dashbaord')) {
    const u = request.nextUrl.clone();
    u.pathname = pathname.replaceAll('/dashbaord', '/dashboard');
    return NextResponse.redirect(u, 308);
  }

  /**
   * `/es/jp/signup` etc. : `jp` (pays ISO) confondu avec la locale `ja`, ou double segment « locale ».
   */
  const strayJp = pathname.match(/^(\/[a-z]{2}(?:-[a-z]{2})?)\/jp(?:\/(.*))?$/i);
  if (strayJp) {
    const u = request.nextUrl.clone();
    const rest = strayJp[2] ?? '';
    u.pathname = rest ? `${strayJp[1]}/${rest}` : strayJp[1];
    return NextResponse.redirect(u, 308);
  }

  /**
   * Liens « Se désabonner » sans préfixe /{locale} (certains clients e-mail / tracking).
   * Sans ça : pathname /newsletter/unsubscribe n'est pas public → redirection vers /login.
   */
  if (pathname === '/newsletter/unsubscribe' || pathname === '/newsletter/unsubscribe/') {
    const u = request.nextUrl.clone();
    const pick = pickNewsletterRedirectLocale(request);
    u.pathname = `/${pick}/newsletter/unsubscribe`;
    return NextResponse.redirect(u);
  }

  /**
   * Lien e-mail : `?locale=es` mais segment URL erroné (`/en/...`) → corriger vers `/es/...`.
   */
  const unsubPathMatch = pathname.match(/^\/([a-z]{2})\/newsletter\/unsubscribe\/?$/);
  if (unsubPathMatch) {
    const pathLocale = unsubPathMatch[1];
    const qLoc = request.nextUrl.searchParams.get('locale')?.toLowerCase().split('-')[0];
    if (
      qLoc &&
      VALID_LOCALES.includes(qLoc as (typeof VALID_LOCALES)[number]) &&
      qLoc !== pathLocale
    ) {
      const u = request.nextUrl.clone();
      u.pathname = `/${qLoc}/newsletter/unsubscribe`;
      return NextResponse.redirect(u);
    }
  }

  const qs = request.nextUrl.search;
  if (qs.length > 2) {
    const blocked = await ghostShieldBlocksSearchParams(request);
    if (blocked) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      return new NextResponse('Bad request', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  if (pathname.startsWith('/api/')) {
    if (
      pathname.startsWith('/api/admin/') &&
      grandCentralUsesIpAllowlist() &&
      !bypassGrandCentralIpForTrustedAutomation(request) &&
      !isGrandCentralIpAllowed(request)
    ) {
      const apiKind = 'ip_blocked_api';
      if (!shouldSkipGrandCentralIntrusionPing(request, apiKind)) {
        fireGrandCentralIntrusionPing(request, apiKind, pathname);
      }
      const res = grandCentralIpBlockedApiResponse(request);
      applyGrandCentralPingDedupeCookie(res, request, apiKind);
      return res;
    }
    return NextResponse.next();
  }

  if (
    isGrandCentralAdminPagePath(pathname) &&
    grandCentralUsesIpAllowlist() &&
    !isGrandCentralIpAllowed(request)
  ) {
    const pageKind = 'ip_blocked_page';
    if (!shouldSkipGrandCentralIntrusionPing(request, pageKind)) {
      fireGrandCentralIntrusionPing(request, pageKind, pathname);
    }
    const res = grandCentralIpBlockedPageResponse(request);
    applyGrandCentralPingDedupeCookie(res, request, pageKind);
    return res;
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
    response.cookies.set('NEXT_LOCALE', lang, nextLocaleCookieSetOptions());
    return response;
  }

  /**
   * Sans cookie NEXT_LOCALE : si l’utilisateur atterrit sur /fr (liens marketing),
   * basculer vers la meilleure locale **Accept-Language** (déjà prioritaire ici : pas de cookie à respecter).
   */
  if (!request.cookies.get('NEXT_LOCALE')?.value) {
    const p = pathname;
    if (p === '/fr' || p === '/fr/') {
      const best = negotiateSiteLocale(request.headers.get('accept-language'));
      if (best && best !== 'fr') {
        const redir = request.nextUrl.clone();
        redir.pathname = p.endsWith('/') ? `/${best}/` : `/${best}`;
        const res = NextResponse.redirect(redir);
        res.cookies.set('NEXT_LOCALE', best, nextLocaleCookieSetOptions());
        supabaseResponse.headers.getSetCookie?.().forEach((cookieStr) => {
          res.headers.append('set-cookie', cookieStr);
        });
        return res;
      }
    }
  }

  /**
   * Le préfixe de locale dans l’URL (ex. `/fr/dashboard`) est la source de vérité pour l’interface :
   * ne pas rediriger `/fr/…` vers une autre locale uniquement parce que NEXT_LOCALE valait une
   * autre langue (sinon choisir « Français » dans le menu puis F5 ramenait par ex. italien).
   * next-intl pose à jour le cookie NEXT_LOCALE selon la locale résolue.
   */

  if (!isPublicRoute(pathname) && !supabaseUser) {
    const locale = VALID_LOCALES.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? routing.defaultLocale;
    const nextUrl = encodeURIComponent(pathname + (request.nextUrl.search || ''));
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('next', nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  if (supabaseUser && !emailConfirmed && !isPublicRoute(pathname)) {
    const locale = VALID_LOCALES.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('message', 'confirm-email');
    return NextResponse.redirect(loginUrl);
  }

  const intlResponse = intlMiddleware(request);
  // Copie les headers Set-Cookie bruts pour préserver toutes les options de sécurité
  // (httpOnly, secure, sameSite, maxAge) — contrairement à cookies.set() qui les perd.
  supabaseResponse.headers.getSetCookie?.().forEach((cookieStr) => {
    intlResponse.headers.append('set-cookie', cookieStr);
  });

  const bindSecret = process.env.GRAND_CENTRAL_BIND_SECRET?.trim();
  if (bindSecret && supabaseUser && isGrandCentralAdminPagePath(pathname)) {
    const fp = grandCentralClientFingerprint(request);
    const sig = await signGrandCentralBind(supabaseUser.id, fp, bindSecret);
    const cur = request.cookies.get(GRAND_CENTRAL_BIND_COOKIE)?.value;
    if (!cur) {
      intlResponse.cookies.set(GRAND_CENTRAL_BIND_COOKIE, sig, {
        httpOnly: true,
        secure: grandCentralCookieSecure(),
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 14,
      });
    } else if (cur !== sig) {
      const bindKind = 'session_bind_mismatch';
      if (!shouldSkipGrandCentralIntrusionPing(request, bindKind)) {
        fireGrandCentralIntrusionPing(request, bindKind, pathname);
      }
      const res = NextResponse.redirect(new URL('/api/auth/grand-central-release', request.url));
      applyGrandCentralPingDedupeCookie(res, request, bindKind);
      return res;
    }
  }

  return intlResponse;
}

/**
 * next-intl : le middleware doit s’exécuter sur `/` et sur tout chemin « page » pour réécrire
 * vers `app/[locale]/…` et poser `X-NEXT-INTL-LOCALE`. Sans ça, `[locale]` n’est pas résolu → 404.
 *
 * On garde aussi `/api/*` dans le matcher (contrairement au snippet next-intl minimal) pour
 * l’allowlist IP Grand Central sur `/api/admin/*` avant le return NextResponse.next().
 *
 * @see https://next-intl.dev/docs/routing/middleware#matcher-config
 */
export const config = {
  matcher: [
    '/',
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
