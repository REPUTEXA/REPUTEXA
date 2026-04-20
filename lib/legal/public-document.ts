import { createClient } from '@/lib/supabase/server';
import { legalTodayUtc } from '@/lib/legal/dates';

export type LegalDocumentType = 'cgu' | 'politique_confidentialite' | 'mentions_legales';

export type PublishedLegalRow = {
  /** French master HTML (authoritative for `fr`). */
  content: string;
  /** Optional per-locale HTML snapshots, e.g. `{ "en": "<article>...</article>" }`. */
  content_translations: Record<string, string> | null;
  version: number;
  effective_date: string;
};

function normalizeLocaleKey(locale: string): string {
  return locale.toLowerCase().split('-')[0] || 'fr';
}

/**
 * Resolves which HTML to show for a locale. For non-French locales, prefers
 * `content_translations[locale]` then `content_translations.en`. Returns `null`
 * when only the French master exists — callers should fall back to message JSON.
 */
export function pickPublishedHtmlForLocale(
  row: PublishedLegalRow,
  locale: string
): string | null {
  const loc = normalizeLocaleKey(locale);
  if (loc === 'fr') {
    return row.content?.trim() ? row.content.trim() : null;
  }
  const tr = row.content_translations;
  if (!tr || typeof tr !== 'object') return null;
  const pick = (k: string): string | null => {
    const v = tr[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  return pick(loc) ?? pick('en') ?? null;
}

/**
 * Dernière publication du type indiqué dont la date d'effet est ≤ aujourd'hui (UTC),
 * aligné sur la modale dashboard et `/api/legal/latest-version`.
 */
export async function getPublishedLegalDocument(
  documentType: LegalDocumentType
): Promise<PublishedLegalRow | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const today = legalTodayUtc();

  let data: {
    content: string | null;
    content_translations: Record<string, string> | null;
    version: number;
    effective_date: string | null;
  } | null = null;
  let error: { message: string } | null = null;

  const resAt = await supabase
    .from('legal_versioning')
    .select('content, content_translations, version, effective_date')
    .eq('document_type', documentType)
    .lte('effective_at', nowIso)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resAt.error && String(resAt.error.message || '').includes('effective_at')) {
    const resLegacy = await supabase
      .from('legal_versioning')
      .select('content, content_translations, version, effective_date')
      .eq('document_type', documentType)
      .lte('effective_date', today)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    error = resLegacy.error;
    data = resLegacy.data;
  } else {
    error = resAt.error;
    data = resAt.data;
  }

  if (error) {
    console.error('[getPublishedLegalDocument]', documentType, error);
    return null;
  }
  if (!data || typeof data.content !== 'string' || !data.content.trim()) {
    return null;
  }
  return {
    content: data.content,
    content_translations: data.content_translations ?? null,
    version: data.version,
    effective_date: data.effective_date ?? '',
  };
}
