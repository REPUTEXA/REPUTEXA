import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

export const dynamic = 'force-dynamic';

/**
 * Test de connexion Google Business : utilise le token stocké en base (profiles.google_access_token)
 * pour lister les comptes Google Business de l'utilisateur.
 * GET /api/google/test-connection
 */
export async function GET(request: Request) {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: t('unauthorized') }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: t('serverError') }, { status: 500 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('google_access_token')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.google_access_token) {
      return NextResponse.json({
        ok: false,
        error: t('errors.google_test_noProviderToken'),
      });
    }

    const accessToken = profile.google_access_token as string;
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();
      console.error('[google/test-connection] Accounts API', accountsRes.status, errText.slice(0, 500));
      return NextResponse.json({
        ok: false,
        error: t('errors.google_test_accountsApiError'),
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
    const tErr = createServerTranslator('Api', apiLocaleFromRequest(request));
    return NextResponse.json({ ok: false, error: tErr('serverError') }, { status: 500 });
  }
}
