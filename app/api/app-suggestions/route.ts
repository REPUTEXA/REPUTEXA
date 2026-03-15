import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/app-suggestions
 * Liste des suggestions produit communautaires.
 * ?status=DONE : uniquement les terminées (pour page Mises à jour), tri par completed_at.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');

  let query = supabase
    .from('app_suggestions')
    .select('id, title, description, status, upvotes_count, created_at, user_id, image_url, completed_at')
    .limit(100);

  if (statusFilter === 'DONE') {
    query = query.eq('status', 'DONE').not('completed_at', 'is', null).order('completed_at', { ascending: false });
  } else {
    query = query.order('upvotes_count', { ascending: false }).order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (statusFilter === 'DONE') {
    return NextResponse.json({ suggestions: data ?? [] });
  }

  const { data: myUpvotes } = await supabase
    .from('app_suggestion_upvotes')
    .select('suggestion_id')
    .eq('user_id', user.id);

  const upvotedIds = new Set((myUpvotes ?? []).map((u) => u.suggestion_id));

  const items = (data ?? []).map((s) => ({
    ...s,
    user_has_upvoted: upvotedIds.has(s.id),
  }));

  return NextResponse.json({ suggestions: items });
}

/**
 * POST /api/app-suggestions
 * Crée une suggestion produit. Accepte JSON ou FormData (avec image).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let title = '';
  let description = '';
  let imageFile: File | null = null;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    if (form) {
      title = String(form.get('title') ?? '').trim();
      description = String(form.get('description') ?? '').trim();
      const img = form.get('image');
      if (img instanceof File && img.size > 0) {
        imageFile = img;
      }
    }
  } else {
    const body = await request.json().catch(() => ({}));
    title = String(body.title ?? '').trim();
    description = String(body.description ?? '').trim();
  }

  if (!title) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 });
  }

  let imageUrl: string | null = null;
  if (imageFile) {
    const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpeg', 'jpg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${safeExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('suggestion-images')
      .upload(path, imageFile, {
        contentType: imageFile.type || 'image/jpeg',
        upsert: false,
      });
    if (uploadError) {
      console.error('[app-suggestions] upload error:', uploadError);
      return NextResponse.json({ error: 'Erreur lors de l\'upload de la photo' }, { status: 500 });
    }
    const { data: urlData } = supabase.storage.from('suggestion-images').getPublicUrl(uploadData.path);
    imageUrl = urlData.publicUrl;
  }

  const { data, error } = await supabase
    .from('app_suggestions')
    .insert({
      user_id: user.id,
      title,
      description: description || '',
      status: 'PENDING',
      ...(imageUrl && { image_url: imageUrl }),
    })
    .select('id, title, description, status, upvotes_count, created_at, image_url')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, suggestion: data });
}
