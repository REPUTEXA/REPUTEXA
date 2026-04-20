/**
 * GET /api/cron/newsletter
 * Publie l’article approuvé et envoie la newsletter multilingue (mardi, via Vercel Cron).
 * Protégé par CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { runBlogForgePublish } from '@/lib/blog-forge/pipeline-publish';

export async function GET(request: Request) {
  const ta = apiAdminT();
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const result = await runBlogForgePublish();

  if (!result.ok && result.error === 'nothing_to_publish') {
    return NextResponse.json({ skipped: true, message: 'no_approved_post' });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'publish_failed' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    slug: result.slug,
    emailsSent: result.emailsSent,
  });
}
