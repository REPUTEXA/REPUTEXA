import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BUCKET = 'banano-wallet-assets';
const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
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

  const mime = (file.type || 'image/png').split(';')[0].trim().toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: 'unsupported_mime' }, { status: 400 });
  }

  const kind = String(form.get('kind') ?? 'logo').trim();
  const safeKind = kind === 'strip' ? 'strip' : 'logo';
  const ext =
    mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'png';

  const path = `${user.id}/${safeKind}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: true,
  });

  if (upErr) {
    console.error('[banano/wallet/upload]', upErr.message);
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl ?? '';

  return NextResponse.json({ ok: true, path, publicUrl, kind: safeKind });
}
