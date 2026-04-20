/** Extrait un aperçu texte sûr pour e-mail admin (pas de HTML interprété). */
export function stripHtmlToPlain(html: string, maxLen: number): string {
  const t = String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
