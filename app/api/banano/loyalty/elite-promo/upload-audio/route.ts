import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ELITE_PROMO_BUCKET, eliteAudioPathForUser } from '@/lib/banano/elite-promo-dispatch';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 6 * 1024 * 1024;

const ALLOWED = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', maxBytes: MAX_BYTES }, { status: 400 });
  }

  const mime = (file.type || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: 'unsupported_mime', mime }, { status: 400 });
  }

  const ext =
    mime === 'audio/ogg'
      ? 'ogg'
      : mime.includes('mpeg') || mime === 'audio/mp3'
        ? 'mp3'
        : mime === 'audio/mp4' || mime === 'audio/m4a' || mime === 'audio/x-m4a'
          ? 'm4a'
          : 'webm';

  const path = `${user.id}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(ELITE_PROMO_BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });

  if (upErr) {
    console.error('[elite-promo upload]', upErr.message);
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }

  if (!eliteAudioPathForUser(user.id, path)) {
    await admin.storage.from(ELITE_PROMO_BUCKET).remove([path]);
    return NextResponse.json({ error: 'path_invalid' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
