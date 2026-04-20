import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

export const dynamic = 'force-dynamic';

/**
 * Route de test : vérifie qu'on arrive à lister les établissements Google Business de l'utilisateur.
 * GET /api/google-business/test
 * Réponse : { ok: true, accountCount, locationCount, locations: [...] } ou { ok: false, error, needsReconnect? }
 */
export async function GET(request: Request) {
  const locale = apiLocaleFromRequest(request);
  const t = createServerTranslator('Api', locale);
  const te = createServerTranslator('ApiEstablishments', locale);
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const providerToken = session.provider_token;
    if (!providerToken) {
      return NextResponse.json({
        ok: false,
        needsReconnect: true,
        error: t('errors.google_test_noProviderToken'),
      });
    }

    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (!accountsRes.ok) {
      await accountsRes.text();
      return NextResponse.json({
        ok: false,
        needsReconnect: true,
        error: t('errors.google_test_accountsApiError'),
      });
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts ?? [];
    if (accounts.length === 0) {
      return NextResponse.json({
        ok: true,
        accountCount: 0,
        locationCount: 0,
        locations: [],
        message: t('errors.google_test_noAccountsMessage'),
      });
    }

    const accountName = accounts[0].name;
    if (!accountName) {
      return NextResponse.json({
        ok: true,
        accountCount: accounts.length,
        locationCount: 0,
        locations: [],
      });
    }

    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    if (!locationsRes.ok) {
      await locationsRes.text();
      return NextResponse.json({
        ok: false,
        needsReconnect: true,
        error: t('errors.google_test_locationsApiError'),
      });
    }

    const locData = await locationsRes.json();
    const raw = locData.locations ?? [];
    const locations = raw.map((loc: { name?: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string; postalCode?: string; regionCode?: string } }) => {
      const addr = loc.storefrontAddress;
      const addressStr = addr
        ? [addr.addressLines?.join(', '), addr.locality, addr.postalCode, addr.regionCode]
            .filter(Boolean)
            .join(', ')
        : '';
      return {
        name: loc.title ?? te('slotUnnamed'),
        fullName: loc.name ?? '',
        address: addressStr || null,
      };
    });

    return NextResponse.json({
      ok: true,
      accountCount: accounts.length,
      locationCount: locations.length,
      locations,
    });
  } catch (e) {
    console.error('[google-business/test]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
