export type NormalizedOutreachEvent = {
  kind: 'open' | 'click' | 'opt_out' | 'bounce';
  email: string | null;
  prospectId: string | null;
  provider: string;
};

function str(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim();
}

/**
 * Contrat interne REPUTEXA + champs usuels Instantly (`event_type`, `lead_email`).
 */
export function normalizeOutreachWebhook(body: unknown): NormalizedOutreachEvent | null {
  if (typeof body !== 'object' || body === null) return null;
  const o = body as Record<string, unknown>;

  const directEvent = str(o.event)?.toLowerCase();
  const directEmail = str(o.email) ?? str(o.lead_email);
  const prospectId = str(o.prospectId) ?? str(o.prospect_id);

  if (directEvent && (directEmail || prospectId)) {
    const map: Record<string, NormalizedOutreachEvent['kind']> = {
      open: 'open',
      opened: 'open',
      click: 'click',
      clicked: 'click',
      unsubscribe: 'opt_out',
      opt_out: 'opt_out',
      bounced: 'bounce',
      bounce: 'bounce',
    };
    const kind = map[directEvent];
    if (!kind) return null;
    return {
      kind,
      email: directEmail,
      prospectId,
      provider: str(o.source) ?? str(o.provider) ?? 'generic',
    };
  }

  const eventType = str(o.event_type)?.toLowerCase() ?? '';
  const leadEmail = str(o.lead_email);
  if (!eventType) return null;

  if (eventType === 'email_opened') {
    return { kind: 'open', email: leadEmail, prospectId: null, provider: 'instantly' };
  }
  if (eventType === 'email_clicked' || eventType === 'link_clicked') {
    return { kind: 'click', email: leadEmail, prospectId: null, provider: 'instantly' };
  }
  if (eventType.includes('unsubscribe') || eventType === 'lead_unsubscribed') {
    return { kind: 'opt_out', email: leadEmail, prospectId: null, provider: 'instantly' };
  }
  if (eventType.includes('bounce') || eventType === 'email_bounced') {
    return { kind: 'bounce', email: leadEmail, prospectId: null, provider: 'instantly' };
  }

  return null;
}
