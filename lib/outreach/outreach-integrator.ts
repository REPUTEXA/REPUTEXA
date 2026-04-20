import { prisma } from '@/lib/prisma';
import { instantlyBulkAddLeads } from '@/lib/outreach/instantly-client';
import {
  GROWTH_PRISMA_STALE_MESSAGE,
  isGrowthSchemaAvailable,
} from '@/lib/growth/prisma-growth-ready';

export type PushInstantlyResult = {
  countryCode: string;
  requested: number;
  pushed: number;
  instantlyStatus: number;
  instantlyBody: unknown;
};

/**
 * Envoie des prospects (email requis) vers la campagne Instantly du pays.
 * Respecte dailyOutreachCap. N’altère pas le statut prospect en cas d’échec API.
 */
export async function pushProspectsToInstantlyForCountry(
  countryCode: string,
  limit?: number
): Promise<PushInstantlyResult> {
  if (!isGrowthSchemaAvailable()) {
    throw new Error(GROWTH_PRISMA_STALE_MESSAGE);
  }

  const apiKey = process.env.INSTANTLY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('INSTANTLY_API_KEY manquant');
  }

  const cc = countryCode.toUpperCase();
  const config = await prisma.growthCountryConfig.findUnique({ where: { countryCode: cc } });
  if (!config?.outreachEnabled) {
    throw new Error(`Marché ${cc} : outreach non activé`);
  }
  if (config.outreachProvider !== 'instantly' || !config.instantlyCampaignId?.trim()) {
    throw new Error(`Marché ${cc} : configurez outreachProvider=instantly et instantlyCampaignId`);
  }

  const cap = Math.min(config.dailyOutreachCap, limit ?? config.dailyOutreachCap);
  const prospects = await prisma.prospect.findMany({
    where: {
      countryCode: cc,
      status: 'TO_CONTACT',
      email: { not: null },
      optedOutAt: null,
    },
    take: cap,
    orderBy: { updatedAt: 'asc' },
  });

  const withEmail = prospects.filter((p) => p.email && p.email.includes('@'));
  if (withEmail.length === 0) {
    return {
      countryCode: cc,
      requested: 0,
      pushed: 0,
      instantlyStatus: 0,
      instantlyBody: { message: 'Aucun prospect avec email' },
    };
  }

  const leads = withEmail.map((p) => ({
    email: p.email!.trim().toLowerCase(),
    company_name: p.establishmentName,
    personalization: (p.pitch ?? '').slice(0, 900),
  }));

  const { ok, status, json } = await instantlyBulkAddLeads(
    apiKey,
    config.instantlyCampaignId.trim(),
    leads
  );

  if (ok) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const p of withEmail) {
        const prev =
          typeof p.metadata === 'object' && p.metadata !== null && !Array.isArray(p.metadata)
            ? (p.metadata as Record<string, unknown>)
            : {};
        await tx.prospect.update({
          where: { id: p.id },
          data: {
            lastOutreachAt: now,
            status: 'CONTACTED',
            metadata: { ...prev, instantlyLastPushAt: now.toISOString() },
          },
        });
        await tx.outreachTouch.create({
          data: {
            prospectId: p.id,
            channel: 'instantly_bulk_add',
            subjectOrRef: config.instantlyCampaignId,
            metadata: { campaign_id: config.instantlyCampaignId },
          },
        });
      }
    });
  }

  return {
    countryCode: cc,
    requested: withEmail.length,
    pushed: ok ? withEmail.length : 0,
    instantlyStatus: status,
    instantlyBody: json,
  };
}
