/**
 * POST /api/admin/document-attestations
 * Enregistre l’empreinte SHA-256 d’un PDF certifié (après sceau + QR) — réservé admin.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  documentId: z.string().uuid(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  issuerLegalName: z.string().min(1).max(240),
  sourceFilename: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { error } = await admin.from('document_attestations').insert({
    id: parsed.data.documentId,
    content_sha256: parsed.data.contentSha256,
    issuer_legal_name: parsed.data.issuerLegalName,
    source_filename: parsed.data.sourceFilename ?? null,
  });

  if (error) {
    console.error('[document-attestations] insert', error);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
