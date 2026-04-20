import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBroadcastScheduleAt, type BroadcastScheduleErrorTexts } from '@/lib/legal/dates';
import { routing } from '@/i18n/routing';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

/** Immédiat si absent ; sinon date future (mêmes bornes que diffusion planifiée ~30 s → ~12 mois). */
function resolveManualUpdatePublishAt(
  raw: unknown,
  scheduleTexts: BroadcastScheduleErrorTexts,
  manualTexts: { invalidDateTime: string; pastDate: string }
): { ok: true; iso: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: true, iso: new Date().toISOString() };
  }
  const d = new Date(String(raw));
  const t = d.getTime();
  if (Number.isNaN(t)) {
    return { ok: false, error: manualTexts.invalidDateTime };
  }
  const now = Date.now();
  if (t < now - 10_000) {
    return { ok: false, error: manualTexts.pastDate };
  }
  if (t <= now + 25_000) {
    return { ok: true, iso: new Date().toISOString() };
  }
  const v = validateBroadcastScheduleAt(String(raw), scheduleTexts);
  if (!v.ok) return { ok: false, error: v.error };
  return { ok: true, iso: d.toISOString() };
}

function parseAttachments(raw: unknown): { url: string; type: 'image' | 'video' }[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: { url: string; type: 'image' | 'video' }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const rec = item as Record<string, unknown>;
    const url = String(rec.url ?? '').trim();
    const type = rec.type;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    if (type !== 'image' && type !== 'video') return null;
    out.push({ url, type });
  }
  return out;
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return { user, isAdmin: profile?.role === 'admin' };
}

/**
 * GET /api/admin/updates
 * Liste toutes les mises à jour manuelles (admin uniquement).
 */
export async function GET() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const { data, error } = await supabase
    .from('app_updates')
    .select('id, title, content, attachments, created_at, publish_at')
    .order('publish_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  return NextResponse.json({ updates: data ?? [] });
}

/**
 * POST /api/admin/updates
 * Crée une mise à jour manuelle (admin uniquement).
 * Body: { title: string, content: string, attachments?: { url, type }[], publish_at?: string (ISO, optionnel) }
 */
export async function POST(request: Request) {
  const ta = apiAdminT();
  const tm = createServerTranslator('ApiAdminManualUpdate', routing.defaultLocale);
  const scheduleTexts: BroadcastScheduleErrorTexts = {
    invalid: tm('scheduleInvalid'),
    tooSoon: tm('scheduleTooSoon'),
    tooFar: tm('scheduleTooFar'),
  };
  const manualTexts = {
    invalidDateTime: tm('invalidPublishAt'),
    pastDate: tm('publishInPast'),
  };

  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  const content = String(body.content ?? '').trim();
  const attachments = parseAttachments(body.attachments);
  if (attachments === null) {
    return NextResponse.json({ error: tm('attachmentsInvalid') }, { status: 400 });
  }

  if (!title || !content) {
    return NextResponse.json({ error: tm('titleAndContentRequired') }, { status: 400 });
  }

  const publishRes = resolveManualUpdatePublishAt(body.publish_at, scheduleTexts, manualTexts);
  if (!publishRes.ok) {
    return NextResponse.json({ error: publishRes.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('app_updates')
    .insert({ user_id: user.id, title, content, attachments, publish_at: publishRes.iso })
    .select('id, title, content, attachments, created_at, publish_at')
    .single();

  if (error) return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  return NextResponse.json({ success: true, update: data });
}

/**
 * PATCH /api/admin/updates
 * Met à jour une mise à jour manuelle (admin uniquement).
 * Body: { id: string, title: string, content: string, attachments?: { url, type }[], publish_at?: string }
 */
export async function PATCH(request: Request) {
  const ta = apiAdminT();
  const tm = createServerTranslator('ApiAdminManualUpdate', routing.defaultLocale);
  const scheduleTexts: BroadcastScheduleErrorTexts = {
    invalid: tm('scheduleInvalid'),
    tooSoon: tm('scheduleTooSoon'),
    tooFar: tm('scheduleTooFar'),
  };
  const manualTexts = {
    invalidDateTime: tm('invalidPublishAt'),
    pastDate: tm('publishInPast'),
  };

  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  const title = String(body.title ?? '').trim();
  const content = String(body.content ?? '').trim();
  const attachments = parseAttachments(body.attachments);
  if (attachments === null) {
    return NextResponse.json({ error: tm('attachmentsInvalid') }, { status: 400 });
  }

  if (!id || !title || !content) {
    return NextResponse.json({ error: tm('patchIdTitleContentRequired') }, { status: 400 });
  }

  const patch: {
    title: string;
    content: string;
    attachments: { url: string; type: 'image' | 'video' }[];
    publish_at?: string;
  } = { title, content, attachments };

  if (body.publish_at !== undefined) {
    const pr = resolveManualUpdatePublishAt(body.publish_at, scheduleTexts, manualTexts);
    if (!pr.ok) {
      return NextResponse.json({ error: pr.error }, { status: 400 });
    }
    patch.publish_at = pr.iso;
  }

  const { data, error } = await supabase
    .from('app_updates')
    .update(patch)
    .eq('id', id)
    .select('id, title, content, attachments, created_at, publish_at')
    .single();

  if (error) return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  return NextResponse.json({ success: true, update: data });
}

/**
 * DELETE /api/admin/updates
 * Supprime une mise à jour manuelle via ?id=... (admin uniquement).
 */
export async function DELETE(request: Request) {
  const ta = apiAdminT();
  const tm = createServerTranslator('ApiAdminManualUpdate', routing.defaultLocale);
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: tm('deleteIdMissing') }, { status: 400 });

  const { error } = await supabase.from('app_updates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  return NextResponse.json({ success: true });
}
