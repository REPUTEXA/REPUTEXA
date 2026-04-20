/**
 * Documents servis sous /docs/ (public/docs/) — injectés dans le RAG support
 * comme vérités institutionnelles, prioritaires sur la connaissance générale du modèle.
 * Complète legal_versioning (CGU / politique / mentions en base Supabase).
 */

import * as fs from 'fs/promises';
import * as path from 'path';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SOURCES: Array<{ rel: string; label: string; maxChars: number }> = [
  {
    rel: 'public/docs/registre-rgpd-reputexa.html',
    label: 'Registre des traitements (public)',
    maxChars: 16_000,
  },
  {
    rel: 'public/docs/compliance-audit-kit/README.md',
    label: 'Kit conformité — guide',
    maxChars: 12_000,
  },
  {
    rel: 'public/docs/compliance-audit-kit/GUIDE-COMPLET-VERIFICATION-CONFORMITE.md',
    label: 'Kit conformité — vérification complète',
    maxChars: 14_000,
  },
  {
    rel: 'public/docs/compliance-audit-kit/FORTRESSE-QUATRE-PILIERS.md',
    label: 'Kit conformité — quatre piliers',
    maxChars: 10_000,
  },
  {
    rel: 'public/docs/compliance-audit-kit/emplacements-logs.md',
    label: 'Kit conformité — emplacements des logs',
    maxChars: 8_000,
  },
  {
    rel: 'public/docs/compliance-audit-kit/liste-sous-traitants.csv',
    label: 'Kit conformité — modèle sous-traitants (CSV)',
    maxChars: 8_000,
  },
];

/**
 * Markdown à fusionner dans le bloc légal / institutionnel du RAG (priorité absolue).
 * Échec lecture : section « fichier absent » (déploiement partiel).
 */
export async function loadPublicDocsTruthForSupport(): Promise<string> {
  const root = process.cwd();
  const sections: string[] = [
    '# VÉRITÉS ABSOLUES — Publications `/public/docs` (site)',
    '',
    'Ces extraits sont publiés par REPUTEXA sous `https://[domaine]/docs/...`. ' +
      'Ils complètent le bloc « Documents légaux officiels » issu de `legal_versioning`. ' +
      '**En cas de conflit avec une connaissance générale, appliquer strictement ces textes et la base légale ci-dessous.**',
    '',
  ];

  for (const src of SOURCES) {
    const abs = path.join(root, ...src.rel.split('/'));
    try {
      const raw = await fs.readFile(abs, 'utf8');
      const text = src.rel.endsWith('.html') ? stripHtml(raw) : raw;
      const clipped =
        text.length > src.maxChars ? `${text.slice(0, src.maxChars)}\n\n… [extrait tronqué — fichier : ${src.rel}]` : text;
      sections.push(`## ${src.label}`);
      sections.push(`_Source : \`${src.rel}\`_`);
      sections.push('');
      sections.push(clipped);
      sections.push('');
    } catch {
      sections.push(`## ${src.label}`);
      sections.push(`_(non disponible sur cet environnement — \`${src.rel}\`)_`);
      sections.push('');
    }
  }

  return sections.join('\n');
}
