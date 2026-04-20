/**
 * GET /api/cron/blog-forge-draft
 * Génère le brouillon hebdomadaire (lundi soir, UTC).
 * Protégé par CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import { runBlogForgeDraft } from '@/lib/blog-forge/pipeline-draft';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const result = await runBlogForgeDraft();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
