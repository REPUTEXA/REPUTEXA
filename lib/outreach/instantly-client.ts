const INSTANTLY_BASE = 'https://api.instantly.ai';

export type InstantlyLeadRow = {
  email: string;
  company_name?: string | null;
  personalization?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type InstantlyBulkAddResponse = {
  leads_uploaded?: number;
  leads_created?: number;
  status?: string;
  message?: string;
  [key: string]: unknown;
};

/**
 * POST /api/v2/leads/add — doc Instantly API v2.
 * @see https://developer.instantly.ai/api-reference/lead/add-leads-in-bulk-to-a-campaign-or-list
 */
export async function instantlyBulkAddLeads(
  apiKey: string,
  campaignId: string,
  leads: InstantlyLeadRow[]
): Promise<{ ok: boolean; status: number; json: InstantlyBulkAddResponse }> {
  const res = await fetch(`${INSTANTLY_BASE}/api/v2/leads/add`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaign_id: campaignId,
      leads: leads.map((l) => ({
        email: l.email,
        company_name: l.company_name ?? undefined,
        personalization: l.personalization ?? undefined,
        first_name: l.first_name ?? undefined,
        last_name: l.last_name ?? undefined,
      })),
    }),
  });

  let json: InstantlyBulkAddResponse = {};
  try {
    json = (await res.json()) as InstantlyBulkAddResponse;
  } catch {
    json = {};
  }

  return { ok: res.ok, status: res.status, json };
}
