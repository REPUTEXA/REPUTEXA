/** Apostrophes / apostrophe-like / tréma → espace (convention caisse / import CRM). */
const APOSTROPHE_LIKE = /[''`´¨]/g;

/**
 * Normalise une saisie caisse ou import : PRÉNOM/NOM en majuscules, sans accents,
 * apostrophe → espace, tout autre ponctuation → espace, espaces resserrés.
 */
export function formatTerminalClientName(input: string): string {
  const s = String(input ?? '').trim();
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(APOSTROPHE_LIKE, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
