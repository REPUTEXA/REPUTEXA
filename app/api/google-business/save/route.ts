import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Appelé après retour OAuth Google Business.
 * Récupère le provider_token de la session, appelle l'API Google Business Profile
 * pour lister les emplacements, puis enregistre le premier dans profiles.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providerToken = session.provider_token;
    if (!providerToken) {
      return NextResponse.json(
        { error: 'Token Google non disponible. Relancez la connexion.' },
        { status: 400 }
      );
    }

    // 1. Lister les comptes Google Business
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (!accountsRes.ok) {
      return NextResponse.json(
        { error: 'Impossible d\'accéder à Google Business. Vérifiez que le profil est configuré.' },
        { status: 400 }
      );
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts ?? [];
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'Aucun compte Google Business trouvé. Créez un profil sur Google.' },
        { status: 400 }
      );
    }

    // Prendre le premier compte (compte personnel en général)
    const accountName = accounts[0].name;
    if (!accountName) {
      return NextResponse.json({ error: 'Format de compte invalide.' }, { status: 400 });
    }

    // 2. Lister les emplacements
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress&pageSize=10`,
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    if (!locationsRes.ok) {
      return NextResponse.json(
        { error: 'Impossible de récupérer les établissements Google.' },
        { status: 400 }
      );
    }

    const locationsData = await locationsRes.json();
    const locations = locationsData.locations ?? [];
    if (locations.length === 0) {
      return NextResponse.json(
        { error: 'Aucun établissement trouvé. Ajoutez un lieu à votre profil Google.' },
        { status: 400 }
      );
    }

    const loc = locations[0];
    const locationId = loc.name ?? '';
    const title = loc.title ?? 'Établissement';
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
      })
      .eq('id', session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      googleLocationId: locationId,
      googleLocationName: title,
      googleLocationAddress: addressStr,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
