import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ensureDefaultGrowthCountries } from '@/lib/growth/ensure-default-countries';
import { prospectMapPhase } from '@/lib/growth/prospect-map-phase';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { SITE_LOCALE_CODES, SITE_LOCALE_META } from '@/lib/i18n/site-locales-catalog';
import { getPartnershipLuxuryBrands } from '@/src/lib/empire-settings';

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

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  try {
    if (!isGrowthSchemaAvailable()) {
      return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
    }
    await ensureDefaultGrowthCountries();

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [configs, statusGroups, prospectsGeo, establishmentsGeo, recentTouches, touches24h, domainGroups] =
      await Promise.all([
        prisma.growthCountryConfig.findMany({ orderBy: { countryCode: 'asc' } }),
        prisma.prospect.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.prospect.findMany({
          where: { lat: { not: null }, lng: { not: null } },
          select: {
            id: true,
            establishmentName: true,
            city: true,
            countryCode: true,
            lat: true,
            lng: true,
            status: true,
            lastOutreachAt: true,
            openedAt: true,
            clickedAt: true,
            optedOutAt: true,
          },
        }),
        prisma.establishment.findMany({
          where: { isActive: true, lat: { not: null }, lng: { not: null } },
          select: {
            id: true,
            name: true,
            city: true,
            lat: true,
            lng: true,
          },
        }),
        prisma.outreachTouch.findMany({
          orderBy: { createdAt: 'desc' },
          take: 40,
          include: {
            prospect: { select: { establishmentName: true } },
          },
        }),
        prisma.outreachTouch.count({ where: { createdAt: { gte: since24h } } }),
        prisma.outreachDomain.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);

    const prospectMarkers = prospectsGeo.map((p) => ({
      type: 'prospect' as const,
      id: p.id,
      label: p.establishmentName,
      city: p.city,
      countryCode: p.countryCode,
      lat: p.lat!,
      lng: p.lng!,
      phase: prospectMapPhase({
        status: p.status,
        optedOutAt: p.optedOutAt,
        lastOutreachAt: p.lastOutreachAt,
        openedAt: p.openedAt,
        clickedAt: p.clickedAt,
      }),
    }));

    const customerMarkers = establishmentsGeo.map((e) => ({
      type: 'customer' as const,
      id: e.id,
      label: e.name,
      city: e.city,
      lat: e.lat!,
      lng: e.lng!,
      phase: 'customer' as const,
    }));

    const configByCountry = Object.fromEntries(configs.map((c) => [c.countryCode, c]));

    const siteLocales = SITE_LOCALE_CODES.map((code) => {
      const meta = SITE_LOCALE_META[code];
      const gate = meta.gateCountryCode;
      const publicSiteOpen = gate
        ? Boolean(configByCountry[gate]?.publicSiteLocaleEnabled)
        : true;
      return {
        code,
        labelFr: meta.labelFr,
        alwaysPublic: gate == null,
        gateCountryCode: gate,
        publicSiteOpen,
      };
    });

    return NextResponse.json({
      luxuryPartnerBrands: [...getPartnershipLuxuryBrands()],
      countries: configs.map((c) => ({
        countryCode: c.countryCode,
        outreachEnabled: c.outreachEnabled,
        dailyOutreachCap: c.dailyOutreachCap,
        localeDefault: c.localeDefault,
        publicSiteLocaleEnabled: c.publicSiteLocaleEnabled,
        outreachProvider: c.outreachProvider,
        instantlyCampaignId: c.instantlyCampaignId,
        smartleadCampaignId: c.smartleadCampaignId,
        notes: c.notes,
        updatedAt: c.updatedAt.toISOString(),
      })),
      webhookOutreachUrl: '/api/webhooks/outreach',
      prospectStatusCounts: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
      domainStatusCounts: Object.fromEntries(domainGroups.map((g) => [g.status, g._count._all])),
      touches24h,
      markers: [...prospectMarkers, ...customerMarkers],
      feed: recentTouches.map((t) => ({
        id: t.id,
        at: t.createdAt.toISOString(),
        channel: t.channel,
        subjectOrRef: t.subjectOrRef,
        prospectName: t.prospect?.establishmentName ?? null,
      })),
      siteLocales,
    });
  } catch (e) {
    console.error('[growth-war-room]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : ta('growthWarRoomDataUnavailable'),
      },
      { status: 500 }
    );
  }
}
