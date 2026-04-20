import { prisma } from '@/lib/prisma';
import { GROWTH_DEFAULT_COUNTRIES } from '@/lib/growth/default-countries';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';

export async function ensureDefaultGrowthCountries(): Promise<void> {
  if (!isGrowthSchemaAvailable()) {
    console.warn('[ensureDefaultGrowthCountries]', 'Prisma sans modèles Growth — npx prisma generate');
    return;
  }
  for (const row of GROWTH_DEFAULT_COUNTRIES) {
    await prisma.growthCountryConfig.upsert({
      where: { countryCode: row.countryCode },
      create: {
        countryCode: row.countryCode,
        outreachEnabled: false,
        dailyOutreachCap: row.dailyOutreachCap,
        localeDefault: row.localeDefault,
      },
      update: {},
    });
  }
}
