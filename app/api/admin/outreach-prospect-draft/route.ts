import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { buildConsultantOutreachDraft } from '@/lib/outreach/consultant-outreach-draft';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  return { user };
}

/**
 * GET /api/admin/outreach-prospect-draft?id=cuid
 * Consultant template preview (no send) for QA.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  if (!isGrowthSchemaAvailable()) {
    return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: ta('idParamRequired') }, { status: 400 });
  }

  const prospect = await prisma.prospect.findUnique({ where: { id } });
  if (!prospect) {
    return NextResponse.json({ error: ta('prospectNotFound') }, { status: 404 });
  }

  let locale = 'fr';
  if (prospect.countryCode) {
    const cfg = await prisma.growthCountryConfig.findUnique({
      where: { countryCode: prospect.countryCode },
    });
    if (cfg?.localeDefault) locale = cfg.localeDefault;
  }

  const draft = buildConsultantOutreachDraft({
    establishmentName: prospect.establishmentName,
    city: prospect.city,
    category: prospect.category,
    rating: prospect.rating,
    lastReviewExcerpt: prospect.lastReviewText,
    lastReviewAuthor: prospect.lastReviewAuthor,
    lastReviewRelative: prospect.lastReviewRelative,
    locale,
  });

  return NextResponse.json({
    prospectId: prospect.id,
    establishmentName: prospect.establishmentName,
    localeUsed: locale,
    subject: draft.subject,
    bodyPlain: draft.bodyPlain,
    pitchStored: prospect.pitch,
  });
}
