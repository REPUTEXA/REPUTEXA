import type { SupabaseClient } from '@supabase/supabase-js';
import { legalTodayUtc } from './dates';

export type CurrentPublishedLegalRow = {
  version: number;
  summary_of_changes: string;
  effective_date: string;
  /** Instant UTC d’entrée en vigueur (migration 144+). */
  effective_at: string | null;
  document_type: string;
};

type LegalVersioningSelectRow = {
  version: number;
  summary_of_changes: string | null;
  effective_date: string | null;
  effective_at?: string | null;
  document_type: string | null;
};

/**
 * Dernière ligne publiée en vigueur : effective_at ≤ maintenant UTC (ou repli date si colonne absente).
 */
export async function fetchCurrentPublishedLegal(
  supabase: SupabaseClient
): Promise<CurrentPublishedLegalRow | null> {
  const nowIso = new Date().toISOString();
  const todayUtc = legalTodayUtc();

  let data: LegalVersioningSelectRow | null = null;
  let error: { message: string } | null = null;

  const resAt = await supabase
    .from('legal_versioning')
    .select('version, summary_of_changes, effective_date, effective_at, document_type')
    .lte('effective_at', nowIso)
    .or('status.eq.ACTIVE,status.eq.active,status.is.null')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resAt.error && String(resAt.error.message || '').includes('effective_at')) {
    const resLegacy = await supabase
      .from('legal_versioning')
      .select('version, summary_of_changes, effective_date, document_type')
      .lte('effective_date', todayUtc)
      .or('status.eq.ACTIVE,status.eq.active,status.is.null')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    error = resLegacy.error;
    data = resLegacy.data as LegalVersioningSelectRow | null;
  } else {
    error = resAt.error;
    data = resAt.data as LegalVersioningSelectRow | null;
  }

  if (error || !data) return null;
  const v = data.version;
  if (typeof v !== 'number') return null;
  return {
    version: v,
    summary_of_changes: String(data.summary_of_changes ?? ''),
    effective_date: String(data.effective_date ?? ''),
    effective_at: data.effective_at != null ? String(data.effective_at) : null,
    document_type: String(data.document_type ?? ''),
  };
}

export function formatLegalDocumentLabelFr(documentType: string): string {
  const m: Record<string, string> = {
    cgu: "Conditions générales d'utilisation",
    politique_confidentialite: 'Politique de confidentialité',
    mentions_legales: 'Mentions légales',
  };
  return m[documentType] ?? documentType;
}
