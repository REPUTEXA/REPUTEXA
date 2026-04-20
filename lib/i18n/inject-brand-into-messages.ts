/**
 * Remplace les occurrences « mot entier » REPUTEXA / Reputexa dans les dictionnaires chargés,
 * pour aligner l’i18n sur `targets/settings.json` (`brand.name`) sans dupliquer des milliers de clés.
 * Ne modifie pas les e-mails techniques (ex. contact@reputexa.fr) ni les slugs type x-reputexa-token.
 */
const RE_UPPER = /\bREPUTEXA\b/g;
const RE_TITLE = /\bReputexa\b/g;

function titleCaseFromBrand(brand: string): string {
  if (!brand) return brand;
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
}

function walk(node: unknown, brandUpper: string, brandTitle: string): unknown {
  if (typeof node === 'string') {
    return node.replace(RE_UPPER, brandUpper).replace(RE_TITLE, brandTitle);
  }
  if (Array.isArray(node)) {
    return node.map((x) => walk(x, brandUpper, brandTitle));
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = walk(v, brandUpper, brandTitle);
    }
    return out;
  }
  return node;
}

export function injectBrandIntoMessages<T>(messages: T, brandName: string): T {
  const brandUpper = brandName.trim() || 'REPUTEXA';
  const brandTitle = titleCaseFromBrand(brandUpper);
  return walk(messages, brandUpper, brandTitle) as T;
}
