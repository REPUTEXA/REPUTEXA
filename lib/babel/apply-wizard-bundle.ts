import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { BabelWizardState } from '@/lib/babel/babel-wizard-types';

const LOCALE_RE = /^[a-z]{2}(-[a-z]{2,4})?$/;

export type ApplyWizardDiskResult = {
  success: boolean;
  written: string[];
  snippetRelPaths: string[];
  warnings: string[];
  errors: string[];
};

function rel(p: string) {
  return p.split(path.sep).join('/');
}

/**
 * Applique sur le disque ce qui peut l’être sans parser du TypeScript fragile :
 * - messages/{locale}.json (JSON valide)
 * - emails/{locale}/README.txt + .gitkeep
 * - tmp/babel-wizard-apply/{locale}/*.md (snippets catalogue, pack serveur, signup, SEO pour merge manuel ou agent)
 */
export async function applyWizardBundleToDisk(params: {
  projectRoot: string;
  state: BabelWizardState;
}): Promise<ApplyWizardDiskResult> {
  const { projectRoot, state } = params;
  const lc = state.localeCode.trim().toLowerCase();
  const written: string[] = [];
  const snippetRelPaths: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!LOCALE_RE.test(lc)) {
    errors.push(`Code locale invalide : ${lc}`);
    return { success: false, written, snippetRelPaths, warnings, errors };
  }

  const messagesRaw = state.outputs.messages?.content?.trim();
  if (messagesRaw) {
    try {
      const parsed = JSON.parse(messagesRaw) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Racine JSON doit être un objet');
      }
      const target = path.join(projectRoot, 'messages', `${lc}.json`);
      await writeFile(target, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
      written.push(rel(path.relative(projectRoot, target)));
    } catch (e) {
      errors.push(`messages/${lc}.json : ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    warnings.push('Étape messages vide : aucun messages/{locale}.json écrit.');
  }

  const emailDir = path.join(projectRoot, 'emails', lc);
  try {
    await mkdir(emailDir, { recursive: true });
    const readme = path.join(emailDir, 'README.txt');
    const body = `Dossier réservé aux gabarits HTML par locale (${lc}).\n` +
      `Les e-mails transactionnels actuels du projet sont surtout dans lib/emails/*.ts.\n` +
      `Vous pouvez ajouter ici des .html de référence ou migrer progressivement les templates.\n`;
    await writeFile(readme, body, 'utf8');
    written.push(rel(path.relative(projectRoot, readme)));
    const gitkeep = path.join(emailDir, '.gitkeep');
    await writeFile(gitkeep, '', 'utf8');
    written.push(rel(path.relative(projectRoot, gitkeep)));
  } catch (e) {
    errors.push(`emails/${lc}/ : ${e instanceof Error ? e.message : String(e)}`);
  }

  const snippetBase = path.join(projectRoot, 'tmp', 'babel-wizard-apply', lc);
  await mkdir(snippetBase, { recursive: true });

  const dumps: { name: string; content: string | undefined }[] = [
    { name: '01-catalog.md', content: state.outputs.catalog?.content },
    { name: '02-server-locale-message-pack.md', content: state.outputs.serverPack?.content },
    { name: '03-signup-ui-by-locale.md', content: state.outputs.signup?.content },
    { name: '04-seo-layout.md', content: state.outputs.seo?.content },
  ];

  for (const { name, content } of dumps) {
    if (!content?.trim()) {
      warnings.push(`Snippet absent : ${name} (étape non générée ou vide).`);
      continue;
    }
    const fp = path.join(snippetBase, name);
    await writeFile(fp, content, 'utf8');
    const rr = rel(path.relative(projectRoot, fp));
    snippetRelPaths.push(rr);
    written.push(rr);
  }

  const success = errors.length === 0;
  return { success, written, snippetRelPaths, warnings, errors };
}

/**
 * Écrit uniquement messages/{locale}.json (ex. flux Expansion).
 */
export async function applyMessagesJsonToDisk(params: {
  projectRoot: string;
  localeCode: string;
  messages: Record<string, unknown>;
}): Promise<{ written: string[]; errors: string[] }> {
  const lc = params.localeCode.trim().toLowerCase();
  const errors: string[] = [];
  if (!LOCALE_RE.test(lc)) {
    errors.push(`Code locale invalide : ${lc}`);
    return { written: [], errors };
  }
  try {
    const target = path.join(params.projectRoot, 'messages', `${lc}.json`);
    await writeFile(target, `${JSON.stringify(params.messages, null, 2)}\n`, 'utf8');
    return { written: [rel(path.relative(params.projectRoot, target))], errors: [] };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { written: [], errors };
  }
}
