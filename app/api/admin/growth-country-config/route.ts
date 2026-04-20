import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ensureDefaultGrowthCountries } from '@/lib/growth/ensure-default-countries';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  countryCode: z.string().min(2).max(4).toUpperCase(),
  outreachEnabled: z.boolean().optional(),
  dailyOutreachCap: z.number().int().min(1).max(50_000).optional(),
  notes: z.string().max(2000).nullable().optional(),
  publicSiteLocaleEnabled: z.boolean().optional(),
  outreachProvider: z
    .union([z.literal('instantly'), z.literal('smartlead'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v)),
  instantlyCampaignId: z.string().max(200).nullable().optional(),
  smartleadCampaignId: z.string().max(200).nullable().optional(),
});

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

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: ta('payloadInvalid'), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    countryCode,
    outreachEnabled,
    dailyOutreachCap,
    notes,
    publicSiteLocaleEnabled,
    outreachProvider,
    instantlyCampaignId,
    smartleadCampaignId,
  } = parsed.data;
  if (
    outreachEnabled === undefined &&
    dailyOutreachCap === undefined &&
    notes === undefined &&
    publicSiteLocaleEnabled === undefined &&
    outreachProvider === undefined &&
    instantlyCampaignId === undefined &&
    smartleadCampaignId === undefined
  ) {
    return NextResponse.json({ error: ta('noFieldsToUpdate') }, { status: 400 });
  }

  try {
    if (!isGrowthSchemaAvailable()) {
      return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
    }
    await ensureDefaultGrowthCountries();
    const updated = await prisma.growthCountryConfig.update({
      where: { countryCode },
      data: {
        ...(outreachEnabled !== undefined ? { outreachEnabled } : {}),
        ...(dailyOutreachCap !== undefined ? { dailyOutreachCap } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(publicSiteLocaleEnabled !== undefined ? { publicSiteLocaleEnabled } : {}),
        ...(outreachProvider !== undefined ? { outreachProvider } : {}),
        ...(instantlyCampaignId !== undefined ? { instantlyCampaignId } : {}),
        ...(smartleadCampaignId !== undefined ? { smartleadCampaignId } : {}),
      },
    });
    return NextResponse.json({
      country: {
        countryCode: updated.countryCode,
        outreachEnabled: updated.outreachEnabled,
        dailyOutreachCap: updated.dailyOutreachCap,
        localeDefault: updated.localeDefault,
        publicSiteLocaleEnabled: updated.publicSiteLocaleEnabled,
        outreachProvider: updated.outreachProvider,
        instantlyCampaignId: updated.instantlyCampaignId,
        smartleadCampaignId: updated.smartleadCampaignId,
        notes: updated.notes,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('[growth-country-config]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('forgeUpdateFailed') },
      { status: 500 }
    );
  }
}
