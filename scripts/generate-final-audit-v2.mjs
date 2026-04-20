/**
 * Consolide l’audit i18n niveau 2 :
 * - Rapport ESLint (règle i18next/no-literal-string, mode=all via .eslintrc.i18n-full-audit.cjs)
 * - Heuristique FR (même logique que audit-ui-strings.mjs)
 *
 * Prérequis : exécuter avant (à la racine du repo) :
 *   npx eslint app components lib --ext .ts,.tsx -c .eslintrc.i18n-full-audit.cjs -f json --no-cache -o eslint-level2-audit.json
 *
 * Usage : node scripts/generate-final-audit-v2.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const FR_HINT =
  /\b(le|les|des|une|pour|avec|votre|vous|erreur|merci|cliqu|enregistr|supprim|établiss|connexion|bientôt)\b/i;

const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'coverage', '.git']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(name.name)) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name.name) && !name.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function heuristicHits() {
  const dirs = [path.join(root, 'app'), path.join(root, 'components'), path.join(root, 'lib')].filter((d) =>
    fs.existsSync(d),
  );
  const files = dirs.flatMap((d) => walk(d));
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('useTranslations') || line.includes('getTranslations')) return;
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
      if (line.includes('className=') && !line.includes('toast') && !line.includes('aria-')) return;
      if (FR_HINT.test(line) && /['"`][^'"`]{8,}['"`]/.test(line)) {
        hits.push({ file: path.relative(root, file), line: i + 1, snippet: line.trim().slice(0, 120) });
      }
    });
  }
  return hits;
}

function normPath(p) {
  return p.replace(/\\/g, '/');
}

function main() {
  const eslintJsonPath = path.join(root, 'eslint-level2-audit.json');
  let eslintFiles = [];
  let eslintMessages = 0;
  let eslintCmd =
    'npx eslint app components lib --ext .ts,.tsx -c .eslintrc.i18n-full-audit.cjs -f json --no-cache -o eslint-level2-audit.json';

  if (fs.existsSync(eslintJsonPath)) {
    const report = JSON.parse(fs.readFileSync(eslintJsonPath, 'utf8'));
    const set = new Set();
    for (const f of report) {
      for (const m of f.messages || []) {
        if (m.ruleId === 'i18next/no-literal-string') {
          eslintMessages++;
          set.add(normPath(f.filePath));
        }
      }
    }
    eslintFiles = [...set].sort();
  }

  const hits = heuristicHits();
  const heuristicFileSet = new Set(hits.map((h) => normPath(h.file)));
  const heuristicFiles = [...heuristicFileSet].sort();

  const eslintRelSet = new Set(
    eslintFiles.map((abs) => normPath(path.relative(root, abs))),
  );

  const out = [];
  out.push('# REPUTEXA — Audit i18n niveau 2 (chaînes hors-JSX & contenu suspect)');
  out.push(`# Généré : ${new Date().toISOString()}`);
  out.push('#');
  out.push('# Interprétation :');
  out.push('#   • Section A : ESLint i18next/no-literal-string en mode « all » sur app/, components/, lib/');
  out.push('#     (la prod reste en jsx-only via .eslintrc.cjs ; cet audit utilise .eslintrc.i18n-full-audit.cjs).');
  out.push('#     Des exclusions limitent les faux positifs évidents (directives module, chaînage Supabase).');
  out.push('#   • Section B : heuristique FR (scripts/audit-ui-strings.mjs) — texte ressemblant au copy utilisateur.');
  out.push('#   • Section C : intersection A∩B — fichiers à prioriser si vous traitez par vagues.');
  out.push('#');
  out.push('# ─────────────────────────────────────────────────────────────────────────────');
  out.push('# A. ESLint — i18next/no-literal-string en mode « all »');
  out.push('#    Config : .eslintrc.i18n-full-audit.cjs (réduit les faux positifs : directives, chaînes chaînées');
  out.push('#    type Supabase .from/.select/.eq, etc.).');
  out.push(`#    Commande : ${eslintCmd}`);
  out.push('#');

  if (eslintFiles.length === 0 && !fs.existsSync(eslintJsonPath)) {
    out.push('#    (Aucun fichier eslint-level2-audit.json — lancez la commande ci-dessus puis réexécutez ce script.)');
    out.push('#');
  } else {
    out.push(`#    Fichiers avec au moins une violation : ${eslintFiles.length}`);
    out.push(`#    Messages total : ${eslintMessages}`);
    out.push('#');
    for (const f of eslintFiles) {
      out.push(f);
    }
    out.push('#');
  }

  out.push('# ─────────────────────────────────────────────────────────────────────────────');
  out.push('# B. Heuristique FR (scripts/audit-ui-strings.mjs — mêmes règles, dossiers app + components + lib)');
  out.push(`#    Fichiers uniques avec au moins une ligne suspecte : ${heuristicFiles.length}`);
  out.push(`#    Lignes signalées : ${hits.length}`);
  out.push('#');
  for (const hf of heuristicFiles) {
    out.push(hf);
  }
  out.push('#');

  out.push('# ─────────────────────────────────────────────────────────────────────────────');
  out.push('# C. Fichiers présents à la fois en A et en B (priorité de revue i18n)');
  out.push('#');
  const prio = heuristicFiles.filter((rel) => eslintRelSet.has(rel));
  const prioUnique = [...new Set(prio)].sort();
  for (const p of prioUnique) {
    out.push(p);
  }
  out.push('#');
  out.push('# Fin du rapport.');
  out.push('');

  fs.writeFileSync(path.join(root, 'final_audit_v2.txt'), out.join('\n'), 'utf8');
  console.log(`Écrit : final_audit_v2.txt (ESLint: ${eslintFiles.length} fichiers, heuristique: ${heuristicFiles.length} fichiers, intersection: ${prioUnique.length})`);
}

main();
