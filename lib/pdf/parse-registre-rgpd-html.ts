/**
 * Parse le HTML public `registre-rgpd-reputexa.html` en sections structurées
 * pour génération PDF (tableaux Champ / Valeur).
 */

export type RegistreTreatmentSection = {
  title: string;
  rows: { label: string; value: string }[];
};

function stripCellHtml(raw: string): string {
  let t = raw.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/(p|div|li)>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/**
 * Extrait les blocs <section> contenant un <h2> et des <div class="grid-row">.
 */
export function parseRegistreRgpdHtml(html: string): RegistreTreatmentSection[] {
  const sections: RegistreTreatmentSection[] = [];
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const scope = bodyMatch ? bodyMatch[1] : html;

  const sectionParts = scope.split(/<section[^>]*>/i).slice(1);
  for (const chunk of sectionParts) {
    const inner = chunk.split(/<\/section>/i)[0];
    const h2m = inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = h2m ? stripCellHtml(h2m[1]) : 'Traitement';

    const rows: { label: string; value: string }[] = [];
    const rowRe = /<div class="grid-row">([\s\S]*?)<\/div>/g;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(inner)) !== null) {
      const block = rm[1];
      const labM = block.match(/<div class="cell cell-label"[^>]*>([\s\S]*?)<\/div>/i);
      const valM = block.match(/<div class="cell cell-value"[^>]*>([\s\S]*?)<\/div>/i);
      if (!labM || !valM) continue;
      const label = stripCellHtml(labM[1]);
      const value = stripCellHtml(valM[1]).replace(/\n+/g, '\n').trim();
      if (label || value) rows.push({ label: label || '—', value: value || '—' });
    }

    if (rows.length > 0) sections.push({ title, rows });
  }

  return sections;
}
