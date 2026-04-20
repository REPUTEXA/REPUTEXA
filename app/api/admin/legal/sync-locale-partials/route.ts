/**
 * POST /api/admin/legal/sync-locale-partials
 * Writes guardianPrivacyHtmlSync into locale-partials/legal/{fr,en,es,de,it}.json
 * then merges into messages/*.json if ALLOW_LEGAL_FS_WRITE=1 (typically local / CI).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

const LOCALES = ['fr', 'en', 'es', 'de', 'it'] as const;

export async function POST(req: NextRequest) {
  const ta = apiAdminT();
  if (process.env.ALLOW_LEGAL_FS_WRITE !== '1') {
    return NextResponse.json(
      {
        error: ta('legalSyncFsDisabled'),
        fsAvailable: false,
      },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  let body: { fragments?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const fragments = body.fragments ?? {};
  const root = process.cwd();
  const written: string[] = [];

  for (const loc of LOCALES) {
    const html = fragments[loc]?.trim();
    if (!html) continue;

    const filePath = path.join(root, 'locale-partials', 'legal', `${loc}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    const j = JSON.parse(raw) as Record<string, unknown>;
    j.guardianPrivacyHtmlSync = html;
    j.guardianPrivacyHtmlSyncAt = new Date().toISOString();
    await fs.writeFile(filePath, `${JSON.stringify(j, null, 2)}\n`, 'utf8');
    written.push(loc);
  }

  try {
    execSync('node scripts/merge-legal-into-messages.mjs', {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (e) {
    return NextResponse.json(
      {
        partial: true,
        written,
        warning: e instanceof Error ? e.message : ta('legalSyncMergeScriptWarning'),
      },
      { status: 200 }
    );
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from('legal_compliance_logs').insert({
      event_type: 'ai_audit',
      message: `Sync locale-partials/legal → messages (guardianPrivacyHtmlSync) : ${written.join(', ')}`,
      metadata: { locales: written },
    });
  }

  return NextResponse.json({ ok: true, written, mergedMessages: true });
}
