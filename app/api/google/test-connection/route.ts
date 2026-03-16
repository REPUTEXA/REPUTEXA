import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Test de connexion Google Business : utilise le token stocké en base (profiles.google_access_token)
 * pour lister les comptes Google Business de l'utilisateur.
 * GET /api/google/test-connection
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Service indisponible' }, { status: 500 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('google_access_token')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.google_access_token) {
      return NextResponse.json({
        ok: false,
        error: 'Aucun token Google stocké. Connectez Google dans Paramètres (Connexion aux plateformes) avec scope business.manage, access_type=offline et prompt=consent.',
      });
    }

    const accessToken = profile.google_access_token as string;
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();
      return NextResponse.json({
        ok: false,
        error: `Google Accounts API: ${accountsRes.status}. ${errText.slice(0, 300)}`,
      });
    }

    const data = await accountsRes.json();
    const accounts = data.accounts ?? [];

    return NextResponse.json({
      ok: true,
      accountCount: accounts.length,
      accounts: accounts.map((a: { name?: string; accountName?: string }) => ({
        name: a.name,
        accountName: a.accountName,
      })),
    });
  } catch (e) {
    console.error('[google/test-connection]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
