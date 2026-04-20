import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ensureDefaultGrowthCountries } from '@/lib/growth/ensure-default-countries';
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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') ?? '').toUpperCase();
  if (code.length < 2) {
    return NextResponse.json({ error: ta('codeRequired') }, { status: 400 });
  }

  try {
    if (!isGrowthSchemaAvailable()) {
      return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
    }
    await ensureDefaultGrowthCountries();
    const country = await prisma.growthCountryConfig.findUnique({ where: { countryCode: code } });
    if (!country) {
      return NextResponse.json({ error: ta('unknownCountry') }, { status: 404 });
    }

    const [domains, statusGroups, touched, opened, clicked, withEmail, total] = await Promise.all([
      prisma.outreachDomain.findMany({
        where: { countryCode: code },
        orderBy: { hostname: 'asc' },
      }),
      prisma.prospect.groupBy({
        by: ['status'],
        where: { countryCode: code },
        _count: { _all: true },
      }),
      prisma.prospect.count({
        where: { countryCode: code, lastOutreachAt: { not: null } },
      }),
      prisma.prospect.count({
        where: { countryCode: code, openedAt: { not: null } },
      }),
      prisma.prospect.count({
        where: { countryCode: code, clickedAt: { not: null } },
      }),
      prisma.prospect.count({
        where: { countryCode: code, email: { not: null } },
      }),
      prisma.prospect.count({ where: { countryCode: code } }),
    ]);

    const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
    const openRate = touched > 0 ? Math.round((opened / touched) * 1000) / 1000 : null;
    const clickRate = touched > 0 ? Math.round((clicked / touched) * 1000) / 1000 : null;

    return NextResponse.json({
      country: {
        countryCode: country.countryCode,
        outreachEnabled: country.outreachEnabled,
        dailyOutreachCap: country.dailyOutreachCap,
        localeDefault: country.localeDefault,
        publicSiteLocaleEnabled: country.publicSiteLocaleEnabled,
        outreachProvider: country.outreachProvider,
        instantlyCampaignId: country.instantlyCampaignId,
        smartleadCampaignId: country.smartleadCampaignId,
        notes: country.notes,
        updatedAt: country.updatedAt.toISOString(),
      },
      domains: domains.map((d) => ({
        id: d.id,
        hostname: d.hostname,
        countryCode: d.countryCode,
        status: d.status,
        notes: d.notes,
      })),
      stats: {
        prospectsTotal: total,
        prospectsWithEmail: withEmail,
        byStatus,
        contactedWithOutreach: touched,
        opened,
        clicked,
        openRate,
        clickRate,
      },
    });
  } catch (e) {
    console.error('[growth-country-detail]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('serverError') },
      { status: 500 }
    );
  }
}
