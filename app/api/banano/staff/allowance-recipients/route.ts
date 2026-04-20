import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

/** Fiches opt-in pour le bon collaborateur mensuel (paramètres + case cochée). */
export async function GET(req: Request) {
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { data: rows, error } = await supabase
    .from('banano_loyalty_members')
    .select('id, display_name, phone_e164, first_name, last_name, crm_role, receives_staff_allowance')
    .eq('user_id', user.id)
    .eq('receives_staff_allowance', true)
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[banano/staff/allowance-recipients]', error.message);
    return NextResponse.json({ error: tm('readFailed') }, { status: 500 });
  }

  return NextResponse.json({ members: rows ?? [] });
}
