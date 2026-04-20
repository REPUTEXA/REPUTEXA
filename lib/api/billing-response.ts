import { NextResponse } from 'next/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { dashboardLocaleFromRequest } from '@/lib/api/request-dashboard-locale';
import { isBillingUserFacingError, type BillingErrorKey } from '@/lib/services/billing-errors';

/** Traductions `Billing` pour la locale cookie dashboard (NEXT_LOCALE). */
export function billingTranslatorFromRequest(request: Request) {
  return createServerTranslator('Billing', dashboardLocaleFromRequest(request));
}

export function billingErrorJson(request: Request, key: BillingErrorKey, status: number) {
  const t = billingTranslatorFromRequest(request);
  return NextResponse.json({ error: t(`errors.${key}`) }, { status });
}

/** Réponse JSON d’erreur : erreurs billing typées ou repli générique localisé (sans fuite de messages techniques). */
export function billingAwareErrorResponse(
  request: Request,
  err: unknown,
  fallbackKey: BillingErrorKey = 'genericError',
  status = 500
) {
  if (isBillingUserFacingError(err)) {
    return billingErrorJson(request, err.key, status);
  }
  const t = billingTranslatorFromRequest(request);
  return NextResponse.json({ error: t(`errors.${fallbackKey}`) }, { status });
}
