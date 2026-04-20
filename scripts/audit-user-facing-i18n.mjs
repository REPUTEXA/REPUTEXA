/**
 * Audit ciblé : texte potentiellement visible (FR) hors t() dans l’UI App Router + components.
 * Exclut app/api, prompts LLM, etc.
 *
 * Usage : node scripts/audit-user-facing-i18n.mjs
 * Sortie : fichiers et extraits à traiter manuellement (faux positifs possibles).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'coverage', '.git', '__tests__']);
const SKIP_FILE = /(\.test\.|\.spec\.|\.stories\.)/;

/** Ligne suspecte si accent FR / mot courant ET chaîne littérale, sans t( sur la même ligne */
const FR_ACCENT = /[àâäéèêëïîôùûçœæ]/i;
const STRING_LIT = /(['"`])[^'"`]{6,}\1/;
const HAS_T =
  /\b(t|getTranslations|useTranslations|createTranslator|namespace\s*:)\s*\(/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(name.name)) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name.name) && !SKIP_FILE.test(name.name)) out.push(p);
  }
  return out;
}

function shouldScanFile(rel) {
  if (rel.startsWith(`app${path.sep}api`)) return false;
  if (rel.includes(`${path.sep}api${path.sep}`)) return false;
  return rel.startsWith(`app${path.sep}`) || rel.startsWith(`components${path.sep}`);
}

function main() {
  const app = path.join(root, 'app');
  const components = path.join(root, 'components');
  const files = [...walk(app), ...walk(components)].filter((f) =>
    shouldScanFile(path.relative(root, f)),
  );

  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('*')) return;
      if (HAS_T.test(line)) return;
      if (line.includes('className=') && !line.includes('toast') && !line.includes('aria-'))
        return;
      if (FR_ACCENT.test(line) && STRING_LIT.test(line)) {
        hits.push({ file: path.relative(root, file), line: i + 1, snippet: line.trim().slice(0, 140) });
      }
    });
  }

  const byFile = new Set(hits.map((h) => h.file));
  console.log(`Fichiers .tsx (app/components hors api) avec lignes suspectes : ${byFile.size}`);
  console.log(`Lignes : ${hits.length}\n`);
  for (const h of hits.slice(0, 120)) {
    console.log(`${h.file}:${h.line}  ${h.snippet}`);
  }
  if (hits.length > 120) console.log(`\n… ${hits.length - 120} autres lignes`);
}

main();
