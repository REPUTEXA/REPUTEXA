/**
 * Empreinte SHA-256 canonique des données figées avant rendu PDF (archives « vitrifiées »).
 * Uniquement Web Crypto (`globalThis.crypto.subtle`) — pas d’import Node : ce module est aussi embarqué
 * côté client (ex. rapport investisseur). Node 18+ expose `globalThis.crypto.subtle` en SSR / API routes.
 */

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) continue;
    out[k] = canonicalize(v);
  }
  return out;
}

export function stableSerializeForPdfIntegrity(payload: unknown): string {
  return JSON.stringify(canonicalize(payload));
}

/** Empreinte hex (64 caractères) du payload canonique — à afficher dans le pied de page Sentinel. */
export async function pdfPayloadIntegritySha256Hex(payload: unknown): Promise<string> {
  const utf8 = stableSerializeForPdfIntegrity(payload);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      '[sentinel-pdf-integrity] Web Crypto (crypto.subtle) indisponible : Node 18+ ou navigateur récent requis.'
    );
  }
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(utf8));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatSentinelGeneratedAtFr(date: Date): string {
  return date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

/** Horodatage du pied de page Sentinel selon la locale du document PDF. */
export function formatSentinelGeneratedAtLocale(date: Date, locale: string): string {
  const tag =
    locale === 'en'
      ? 'en-US'
      : locale === 'de'
        ? 'de-DE'
        : locale === 'es'
          ? 'es-ES'
          : locale === 'it'
            ? 'it-IT'
            : locale === 'pt'
              ? 'pt-PT'
              : locale === 'ja'
                ? 'ja-JP'
                : locale === 'zh'
                  ? 'zh-CN'
                  : 'fr-FR';
  return date.toLocaleString(tag, { dateStyle: 'long', timeStyle: 'short' });
}
