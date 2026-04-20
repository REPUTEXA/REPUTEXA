/**
 * Extrait le code utile d’un .md produit par le wizard (bloc ```ts optionnel).
 */
export function extractSnippetFromMd(raw: string): string {
  const fenced = raw.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return raw.trim();
}
