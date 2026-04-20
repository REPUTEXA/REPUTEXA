import type { SupabaseClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';

/** Profils avec abonnement facturable encore « en vie » côté applicatif. */
const SUBSCRIBED_STATUSES = ['active', 'trialing', 'past_due'] as const;

export type AuditExportMerchantRow = {
  id: string;
  label: string;
  email: string | null;
};

const PAGE = 1000;

/**
 * Tous les clients abonnés (non-admin), pour filtre export audit — pagination serveur.
 */
export async function loadSubscribedMerchantsForAudit(
  admin: SupabaseClient
): Promise<AuditExportMerchantRow[]> {
  const raw: {
    id: string;
    establishment_name: string | null;
    full_name: string | null;
    email: string | null;
  }[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, establishment_name, full_name, email')
      .neq('role', 'admin')
      .in('subscription_status', [...SUBSCRIBED_STATUSES])
      .order('establishment_name', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error('[compliance-audit-subscribers]', error.message);
      break;
    }
    if (!data?.length) break;
    raw.push(...(data as typeof raw));
    if (data.length < PAGE) break;
  }

  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.complianceAuditSubscribers' });

  return raw.map((r) => {
    const id = r.id;
    const estab = r.establishment_name?.trim();
    const fname = r.full_name?.trim();
    const label = estab || fname || t('fallbackAccountLabel', { id });
    const email = r.email?.trim() || null;
    return { id, label, email };
  });
}
