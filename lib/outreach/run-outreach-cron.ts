import { prisma } from '@/lib/prisma';
import { ensureDefaultGrowthCountries } from '@/lib/growth/ensure-default-countries';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { pushProspectsToInstantlyForCountry } from '@/lib/outreach/outreach-integrator';

export type OutreachCronRowResult = {
  countryCode: string;
  ok: boolean;
  pushed?: number;
  requested?: number;
  instantlyStatus?: number;
  error?: string;
};

/**
 * Pousse des prospects vers Instantly pour chaque marché actif (provider instantly + campagne).
 * À appeler depuis un cron sécurisé ou un bouton admin.
 */
export async function runOutreachActiveCountriesCron(): Promise<{
  ran: boolean;
  results: OutreachCronRowResult[];
}> {
  if (!isGrowthSchemaAvailable()) {
    return { ran: false, results: [] };
  }

  await ensureDefaultGrowthCountries();

  const countries = await prisma.growthCountryConfig.findMany({
    where: {
      outreachEnabled: true,
      outreachProvider: 'instantly',
      instantlyCampaignId: { not: null },
    },
  });

  const results: OutreachCronRowResult[] = [];

  for (const c of countries) {
    const id = c.instantlyCampaignId?.trim();
    if (!id) continue;
    try {
      const r = await pushProspectsToInstantlyForCountry(c.countryCode, c.dailyOutreachCap);
      results.push({
        countryCode: r.countryCode,
        ok: true,
        pushed: r.pushed,
        requested: r.requested,
        instantlyStatus: r.instantlyStatus,
      });
    } catch (e) {
      results.push({
        countryCode: c.countryCode,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { ran: true, results };
}
