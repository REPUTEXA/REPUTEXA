import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Liste les établissements Google Business non encore importés dans REPUTEXA.
 * Utilise le provider_token de la session (pas besoin de se reconnecter si déjà lié).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providerToken = session.provider_token;
    if (!providerToken) {
      return NextResponse.json({
        locations: [],
        needsReconnect: true,
        message: 'Relancez la connexion Google dans Paramètres pour importer vos lieux.',
      });
    }

    const userId = session.user.id;

    const [accountsRes, profileRes, establishmentsRes] = await Promise.all([
      fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${providerToken}` },
      }),
      supabase
        .from('profiles')
        .select('google_location_id')
        .eq('id', userId)
        .single(),
      supabase
        .from('establishments')
        .select('google_location_id')
        .eq('user_id', userId),
    ]);

    if (!accountsRes.ok) {
      return NextResponse.json({
        locations: [],
        needsReconnect: true,
        message: 'Token Google expiré. Reconnectez Google dans Paramètres.',
      });
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts ?? [];
    if (accounts.length === 0) {
      return NextResponse.json({ locations: [], needsReconnect: false });
    }

    const alreadyImported = new Set<string>();
    const profileLoc = profileRes.data?.google_location_id;
    if (profileLoc) alreadyImported.add(profileLoc);
    for (const e of establishmentsRes.data ?? []) {
      if (e.google_location_id) alreadyImported.add(e.google_location_id);
    }

    const accountName = accounts[0].name;
    if (!accountName) {
      return NextResponse.json({ locations: [], needsReconnect: false });
    }

    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    if (!locationsRes.ok) {
      return NextResponse.json({
        locations: [],
        needsReconnect: true,
        message: 'Impossible de lister vos lieux Google.',
      });
    }

    const locData = await locationsRes.json();
    const raw = locData.locations ?? [];
    const unimported = raw
      .filter((loc: { name?: string }) => {
        const fullName = loc.name ?? '';
        return !alreadyImported.has(fullName);
      })
      .map((loc: { name?: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string; postalCode?: string; regionCode?: string } }) => {
        const fullName = loc.name ?? '';
        const placeId = fullName.split('/').pop() ?? fullName;
        const addr = loc.storefrontAddress;
        const addressStr = addr
          ? [addr.addressLines?.join(', '), addr.locality, addr.postalCode, addr.regionCode]
              .filter(Boolean)
              .join(', ')
          : '';
        return {
          id: placeId,
          fullName,
          name: loc.title ?? 'Sans nom',
          address: addressStr || null,
        };
      });

    return NextResponse.json({
      locations: unimported,
      needsReconnect: false,
    });
  } catch (e) {
    console.error('[google-business/list-locations]', e);
    return NextResponse.json(
      { locations: [], needsReconnect: true, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
