/**
 * Heuristique : repère du texte utilisateur potentiellement encore en dur (FR).
 * Usage : node scripts/audit-ui-strings.mjs
 * Faux positifs : commentaires, noms de classes, regex, etc. — filtrer à la main.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const FR_HINT =
  /\b(le|les|des|une|pour|avec|votre|vous|erreur|merci|cliqu|enregistr|supprim|établiss|connexion|bientôt)\b/i;

const SKIP_DIR = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '.git',
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(name.name)) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name.name) && !name.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function main() {
  const dirs = [path.join(root, 'app'), path.join(root, 'components'), path.join(root, 'lib')].filter(
    (d) => fs.existsSync(d),
  );
  const files = dirs.flatMap((d) => walk(d));
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('useTranslations') || line.includes('getTranslations')) return;
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
      if (line.includes('className=') && !line.includes('toast') && !line.includes('aria-'))
        return;
      if (FR_HINT.test(line) && /['"`][^'"`]{8,}['"`]/.test(line)) {
        hits.push({ file: path.relative(root, file), line: i + 1, snippet: line.trim().slice(0, 120) });
      }
    });
  }
  console.log(`Fichiers avec lignes suspectes (heuristique FR) : ${new Set(hits.map((h) => h.file)).size}`);
  console.log(`Lignes : ${hits.length}\n`);
  for (const h of hits.slice(0, 80)) {
    console.log(`${h.file}:${h.line}  ${h.snippet}`);
  }
  if (hits.length > 80) console.log(`\n… ${hits.length - 80} autres lignes`);
}

main();
