import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ELITE_PROMO_BUCKET, eliteAudioPathForUser } from '@/lib/banano/elite-promo-dispatch';
import { transcribeAudioFromBuffer } from '@/lib/whisper';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

export const dynamic = 'force-dynamic';

type Body = {
  path?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const path = typeof body.path === 'string' ? body.path.trim() : '';
  if (!path || !eliteAudioPathForUser(user.id, path)) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  const { data: blob, error: dlErr } = await admin.storage.from(ELITE_PROMO_BUCKET).download(path);
  if (dlErr || !blob) {
    return NextResponse.json({ error: 'download_failed' }, { status: 404 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());

  const { data: prof } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', user.id)
    .maybeSingle();
  const loc = normalizeAppLocale((prof as { language?: string | null } | null)?.language ?? undefined);
  const whisperLang = loc.startsWith('fr')
    ? 'fr'
    : loc.startsWith('en')
      ? 'en'
      : loc.startsWith('de')
        ? 'de'
        : loc.startsWith('es')
          ? 'es'
          : loc.startsWith('it')
            ? 'it'
            : loc.startsWith('pt')
              ? 'pt'
              : loc.startsWith('ja')
                ? 'ja'
                : loc.startsWith('zh')
                  ? 'zh'
                  : undefined;

  try {
    const text = await transcribeAudioFromBuffer(buf, {
      filename: path.split('/').pop() || 'audio.webm',
      language: whisperLang,
    });
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return NextResponse.json({ ok: true, text: trimmed });
  } catch (e) {
    console.error('[elite-promo transcribe]', e);
    return NextResponse.json({ error: 'transcribe_failed' }, { status: 502 });
  }
}
