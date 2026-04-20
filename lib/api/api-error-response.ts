import { NextResponse } from 'next/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { routing } from '@/i18n/routing';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

/** Erreur JSON localisée (`Api` dans messages). */
export function apiJsonError(
  request: Request,
  key: string,
  status: number,
  values?: Record<string, string | number | boolean>
): NextResponse {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  return NextResponse.json({ error: values ? t(key, values) : t(key) }, { status });
}

/** Même chose sans requête (rare) : locale par défaut du site. */
export function apiJsonErrorDefaultLocale(key: string, status: number): NextResponse {
  const t = createServerTranslator('Api', routing.defaultLocale);
  return NextResponse.json({ error: t(key) }, { status });
}

/** Champ `message` (ex. crons, réponses OK). */
export function apiJsonMessage(
  request: Request,
  key: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  return NextResponse.json({ ok: true, message: t(key), ...extra }, { status });
}

/** Erreur facturation Stripe (`Api.errors.billing.*`). */
export function apiBillingJsonError(
  request: Request,
  key: string,
  status: number,
  values?: Record<string, string | number | boolean>
): NextResponse {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  const path = `errors.billing.${key}`;
  return NextResponse.json({ error: values ? t(path, values) : t(path) }, { status });
}

/** Même chose pour webhooks / appels sans locale navigateur (Stripe → serveur). */
export function apiBillingJsonErrorDefaultLocale(
  key: string,
  status: number,
  values?: Record<string, string | number | boolean>
): NextResponse {
  const t = createServerTranslator('Api', routing.defaultLocale);
  const path = `errors.billing.${key}`;
  return NextResponse.json({ error: values ? t(path, values) : t(path) }, { status });
}

/** `{ ok: false, error }` localisé (ex. sync-profile POST). */
export function apiBillingFailureJson(
  request: Request,
  key: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  return NextResponse.json({ ok: false, error: t(`errors.billing.${key}`), ...extra }, { status });
}

/** Erreur IA côté commerçant (`Api.errors.ia.*`) — limites fournisseur / indisponibilité, pas un bug applicatif. */
export function apiIaJsonError(
  request: Request,
  key: string,
  status: number,
  values?: Record<string, string | number | boolean>
): NextResponse {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  const path = `errors.ia.${key}`;
  return NextResponse.json({ error: values ? t(path, values) : t(path) }, { status });
}

/** Erreurs routes `/api/ai/*` côté marchand (`ApiAi` dans messages). */
export function apiMerchantAiJsonError(request: Request, key: string, status: number): NextResponse {
  const t = createServerTranslator('ApiAi', apiLocaleFromRequest(request));
  return NextResponse.json({ error: t(key) }, { status });
}
