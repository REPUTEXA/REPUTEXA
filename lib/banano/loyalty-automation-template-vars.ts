import type { SupabaseClient } from '@supabase/supabase-js';

const DERNIER_PRODUIT_RE = /\{\{\s*dernier_produit\s*\}\}/i;

/** Placeholder demandé pour debug / extension future. */
export const getLoyaltyTemplateVars = () => ({});

export function automationTemplateUsesDernierProduit(
  baseTemplate: string,
  personalizedMiddle: string
): boolean {
  return DERNIER_PRODUIT_RE.test(baseTemplate) || DERNIER_PRODUIT_RE.test(personalizedMiddle);
}

/**
 * Extrait une courte étiquette « dernier produit » depuis la note du dernier événement fidélité.
 */
export async function fetchDernierProduitFromLastEventNote(
  admin: SupabaseClient,
  memberId: string
): Promise<string> {
  const { data } = await admin
    .from('banano_loyalty_events')
    .select('note')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const n = (data as { note?: string | null } | null)?.note;
  return typeof n === 'string' ? n.trim().slice(0, 500) : '';
}
