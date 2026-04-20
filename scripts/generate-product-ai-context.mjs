/**
 * Construit lib/generated/product-ai-context.txt pour enrichir les prompts IA admin
 * (changelog manuel, e-mails info, légal) avec l’historique Git récent + CHANGELOG.md.
 *
 * Exécuté sur `npm run build` / `npm run dev` — pas de secrets, uniquement du texte.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'lib', 'generated');
const OUT_FILE = join(OUT_DIR, 'product-ai-context.txt');

function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 4_000_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function recentCommitMessages() {
  return git('log -n 45 --pretty=format:- %h %s');
}

function recentChangedPaths() {
  for (const n of [35, 20, 12, 6, 1]) {
    const out = git(`diff --name-only HEAD~${n}..HEAD`);
    if (out) return out;
  }
  return git('diff --name-only HEAD');
}

function changelogExcerpt() {
  const p = join(ROOT, 'CHANGELOG.md');
  if (!existsSync(p)) return '';
  try {
    return readFileSync(p, 'utf8').slice(0, 8000);
  } catch {
    return '';
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const chunks = [];
chunks.push('Contexte dépôt REPUTEXA — généré automatiquement (git + CHANGELOG).');
chunks.push("Utilisation : aide factuelle pour rédiger annonces, e-mails et résumés ; n'invente pas de fonctionnalités absentes d'ici.");
chunks.push('');

const commits = recentCommitMessages();
if (commits) {
  chunks.push('--- Derniers commits ---');
  chunks.push(commits);
  chunks.push('');
}

const paths = recentChangedPaths();
if (paths) {
  const lines = [...new Set(paths.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 220);
  chunks.push('--- Fichiers modifiés récemment (chemins) ---');
  chunks.push(lines.join('\n'));
  chunks.push('');
}

const ch = changelogExcerpt();
if (ch.trim()) {
  chunks.push('--- CHANGELOG.md (extrait) ---');
  chunks.push(ch);
  chunks.push('');
}

const body = chunks.join('\n').trim();
writeFileSync(OUT_FILE, body || '(aucun contexte git/CHANGELOG — exécutez dans un clone Git avec historique)', 'utf8');
console.log('[product:ai-context]', OUT_FILE, `→ ${body.length} caractères`);
