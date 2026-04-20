/** Correspondance heuristique avis Google ↔ fiche fidélité (pas de téléphone sur les avis). */

export function reviewMatchesMember(
  review: { reviewer_name: string },
  member: {
    display_name: string;
    first_name?: string | null;
    last_name?: string | null;
  }
): boolean {
  const rn = review.reviewer_name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!rn) return false;
  const dn = (member.display_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (dn && rn === dn) return true;
  const fn = (member.first_name || '').trim().toLowerCase();
  const ln = (member.last_name || '').trim().toLowerCase();
  if (fn && ln) {
    if (rn === `${fn} ${ln}` || rn === `${ln} ${fn}`) return true;
    if (rn.includes(fn) && rn.includes(ln)) return true;
  }
  if (fn && (rn === fn || rn.startsWith(`${fn} `))) return true;
  return false;
}
