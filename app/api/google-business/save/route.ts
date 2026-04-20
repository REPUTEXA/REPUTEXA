import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

/**
 * Appelé après retour OAuth Google Business.
 * Récupère le provider_token de la session, appelle l'API Google Business Profile
 * pour lister les emplacements, puis enregistre le premier dans profiles.
 */
export async function POST(request: Request) {
  try {
    const t = createServerTranslator('Api', apiLocaleFromRequest(request));
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const providerToken = session.provider_token;
    if (!providerToken) {
      return apiJsonError(request, 'errors.google_tokenUnavailable', 400);
    }

    const sessionWithProvider = session as { provider_refresh_token?: string };
    const tokenUpdates: Record<string, string | null> = {
      google_access_token: providerToken,
      google_refresh_token: sessionWithProvider.provider_refresh_token ?? null,
    };

    // 1. Lister les comptes Google Business
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (!accountsRes.ok) {
      return apiJsonError(request, 'errors.google_accountsAccessFailed', 400);
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts ?? [];
    if (accounts.length === 0) {
      return apiJsonError(request, 'errors.google_noBusinessAccount', 400);
    }

    // Prendre le premier compte (compte personnel en général)
    const accountName = accounts[0].name;
    if (!accountName) {
      return apiJsonError(request, 'errors.google_accountFormatInvalid', 400);
    }

    // 2. Lister les emplacements
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress&pageSize=10`,
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    if (!locationsRes.ok) {
      return apiJsonError(request, 'errors.google_locationsFetchFailed', 400);
    }

    const locationsData = await locationsRes.json();
    const locations = locationsData.locations ?? [];
    if (locations.length === 0) {
      return apiJsonError(request, 'errors.google_noLocation', 400);
    }

    const loc = locations[0];
    const locationId = loc.name ?? '';
    const title = loc.title ?? t('errors.googleImportedLocationTitle');
    const addr = loc.storefrontAddress;
    const addressStr = addr
      ? [addr.addressLines?.join(', '), addr.locality, addr.postalCode, addr.regionCode]
          .filter(Boolean)
          .join(', ')
      : '';

    const { error } = await supabase
      .from('profiles')
      .update({
        google_location_id: locationId,
        google_location_name: title,
        google_location_address: addressStr || null,
        google_connected_at: new Date().toISOString(),
        ...tokenUpdates,
      })
      .eq('id', session.user.id);

    if (error) {
      return apiJsonError(request, 'serverError', 500);
    }

    return NextResponse.json({
      ok: true,
      googleLocationId: locationId,
      googleLocationName: title,
      googleLocationAddress: addressStr,
    });
  } catch {
    return apiJsonError(request, 'serverError', 500);
  }
}
