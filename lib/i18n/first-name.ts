/**
 * Premier prénom pour personnalisation e-mails (depuis `profiles.full_name` ou métadonnées).
 */
export function firstNameFromFullName(fullName: string | null | undefined): string {
  const t = (fullName ?? '').trim();
  if (!t) return '';
  const parts = t.split(/\s+/).filter(Boolean);
  return parts[0] ?? '';
}
