import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';

const VALID = routing.locales;

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { locale } = body as { locale?: string };
    if (!locale || !VALID.includes(locale as (typeof VALID)[number])) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ language: locale, preferred_language: locale })
      .eq('id', user.id);

    if (error) {
      console.error('[api/user/locale] profile update', error);
    }

    return NextResponse.json({ ok: true, locale });
  } catch (error) {
    console.error('[api/user/locale]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
