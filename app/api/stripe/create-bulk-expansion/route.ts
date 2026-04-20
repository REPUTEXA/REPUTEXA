/**
 * POST /api/stripe/create-bulk-expansion
 * Expansion multi-établissements. Délègue au BillingDomainService.
 * L'établissement est "activé" côté UI après réception du webhook invoice.paid (sync quantity).
 */

import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';
import { createBulkExpansionBodySchema } from '@/lib/validations/stripe';
import { createExpansionSession } from '@/lib/services/billing-domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = createBulkExpansionBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiBillingJsonError(request, 'expansionAddCountRequired', 400);
    }
    const { expansionAddCount } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email?.trim()) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const { searchParams } = new URL(request.url);
    const locale = resolveStripePaymentLocaleFromRequest(request, {
      queryLocale: searchParams.get('locale'),
    });
    const successUrl = `${baseUrl}/${locale}/dashboard/establishments?status=upgraded&openConfig=1`;

    const { url } = await createExpansionSession({
      email: user.email.trim().toLowerCase(),
      addCount: expansionAddCount,
      locale,
    });

    return NextResponse.json({ url: url || successUrl });
  } catch (err) {
    console.error('[stripe/create-bulk-expansion]', err);
    return apiBillingJsonError(request, 'expansionFlowFailed', 500);
  }
}
