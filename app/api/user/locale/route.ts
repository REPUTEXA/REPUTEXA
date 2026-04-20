import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

const VALID = routing.locales;

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const body = await request.json().catch(() => ({}));
    const { locale } = body as { locale?: string };
    if (!locale || !VALID.includes(locale as (typeof VALID)[number])) {
      return apiJsonError(request, 'errors.invalidLocale', 400);
    }

    /**
     * La langue d’interface vit dans le cookie NEXT_LOCALE (défini côté client avant navigation).
     * On ne met plus à jour le profil ici : sinon le sélecteur en tête d’écran écrasait la
     * « langue de base » utilisée pour les e-mails et communications (réglée dans Paramètres).
     */

    return NextResponse.json({ ok: true, locale });
  } catch (error) {
    console.error('[api/user/locale]', error);
    const t = createServerTranslator('Api');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : t('serverError') },
      { status: 500 }
    );
  }
}
