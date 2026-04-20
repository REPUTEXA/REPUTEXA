import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null as null, isAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return { user, isAdmin: profile?.role === 'admin' };
}

function extFromMime(mime: string): string {
  const base = mime.split('/')[1]?.split('+')[0]?.split(';')[0]?.trim() ?? 'bin';
  return base.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
}

/**
 * POST /api/admin/updates/upload
 * multipart/form-data, champ "file" — admin uniquement.
 * Réponse : { url, type: "image" | "video" }
 */
export async function POST(request: Request) {
  const ta = apiAdminT();
  const tu = createServerTranslator('ApiAdminUpdatesUpload', routing.defaultLocale);
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: tu('multipartRequired') }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: tu('fileMissing') }, { status: 400 });
  }

  const mime = (file.type || 'application/octet-stream').toLowerCase().split(';')[0].trim();
  let mediaType: 'image' | 'video';

  if (mime.startsWith('image/')) {
    mediaType = 'image';
  } else if (mime.startsWith('video/')) {
    mediaType = 'video';
  } else {
    return NextResponse.json(
      {
        error: tu('wrongMimeType'),
      },
      { status: 400 }
    );
  }

  const ext = extFromMime(mime);
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('app-update-media')
    .upload(path, file, { contentType: mime, upsert: false });

  if (uploadError) {
    console.error('[admin/updates/upload]', uploadError);
    return NextResponse.json({ error: tu('uploadFailed') }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('app-update-media').getPublicUrl(uploadData.path);

  return NextResponse.json({
    url: urlData.publicUrl,
    type: mediaType,
  });
}
