#!/usr/bin/env node
/**
 * Audit des chaînes « probablement UI » dans app/ et components/ (heuristique).
 * Ne modifie aucun fichier par défaut — un refactor i18n massif automatisé casserait le JSX.
 *
 * Usage :
 *   node scripts/babel-clean.mjs
 *   node scripts/babel-clean.mjs --json > babel-clean-report.json
 *
 * Mode --fix (manifeste uniquement, pas de scan « magique ») :
 *   BABEL_CLEAN_FIX_CONFIRM=I_UNDERSTAND node scripts/babel-clean.mjs --fix --manifest=scripts/babel-clean-fix-manifest.json
 * Copiez babel-clean-fix-manifest.example.json et listez search/replace/frJson exacts.
 * Vous devez ajouter useTranslations('…') dans les composants modifiés si besoin.
 */

import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components'];

function deepMergeTarget(target, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    const t = target[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && t && typeof t === 'object' && !Array.isArray(t)) {
      deepMergeTarget(t, v);
    } else {
      target[k] = v;
    }
  }
}

async function runFixFromManifest() {
  if (process.env.BABEL_CLEAN_FIX_CONFIRM !== 'I_UNDERSTAND') {
    console.error('Refus : définissez BABEL_CLEAN_FIX_CONFIRM=I_UNDERSTAND');
    process.exit(1);
  }
  const arg = process.argv.find((a) => a.startsWith('--manifest='));
  const manifestPath = arg
    ? path.resolve(ROOT, arg.slice('--manifest='.length))
    : path.join(ROOT, 'scripts', 'babel-clean-fix-manifest.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  const j = JSON.parse(raw);
  const reps = j.replacements;
  if (!Array.isArray(reps) || reps.length === 0) {
    console.error('Manifeste : tableau "replacements" vide ou absent.');
    process.exit(1);
  }
  const frPath = path.join(ROOT, 'messages', 'fr.json');
  let fr = JSON.parse(await fs.readFile(frPath, 'utf8'));
  for (const r of reps) {
    if (!r.file || !r.search || r.replace == null) continue;
    const fp = path.join(ROOT, r.file);
    let src = await fs.readFile(fp, 'utf8');
    const count = src.split(r.search).length - 1;
    if (count === 0) {
      console.warn('Absent (skip):', r.file, String(r.search).slice(0, 48));
      continue;
    }
    if (count > 1) {
      console.warn('Ambigu (skip, plusieurs occurrences):', r.file);
      continue;
    }
    src = src.replace(r.search, r.replace);
    await fs.writeFile(fp, src, 'utf8');
    console.log('OK', r.file);
    if (r.frJson && typeof r.frJson === 'object') deepMergeTarget(fr, r.frJson);
  }
  await fs.writeFile(frPath, `${JSON.stringify(fr, null, 2)}\n`, 'utf8');
  console.log('messages/fr.json fusionné.');
}
const EXT = new Set(['.tsx', '.ts']);
const SKIP_PARTS = ['node_modules', '.next', 'dist', 'coverage', '.git'];

/** Lettres typiques du français / accents (signal faible mais utile pour un premier tri) */
const FRENCHY = /[àâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ]/;

function shouldSkipDir(name) {
  return SKIP_PARTS.some((p) => name === p || name.startsWith('.'));
}

async function walk(dir, acc) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name)) continue;
      await walk(path.join(dir, ent.name), acc);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name);
      if (!EXT.has(ext)) continue;
      acc.push(path.join(dir, ent.name));
    }
  }
}

function stringsInLine(line) {
  const out = [];
  const dq = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = dq.exec(line)) !== null) out.push(m[1] ?? '');
  const sq = /'((?:[^'\\]|\\.)*)'/g;
  while ((m = sq.exec(line)) !== null) out.push(m[1] ?? '');
  return out;
}

function extractCandidates(source, fileRel) {
  const lines = source.split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\/\/|^\s*\/\*/.test(line)) continue;
    for (const raw of stringsInLine(line)) {
      const s = raw.replace(/\\n/g, ' ').replace(/\\"/g, '"');
      if (s.length < 6) continue;
      if (!FRENCHY.test(s) && !/[A-Za-z]{12,}/.test(s)) continue;
      if (/^[\w./:@-]+$/.test(s) && !FRENCHY.test(s)) continue;
      hits.push({ line: i + 1, sample: s.slice(0, 120) });
    }
  }
  if (hits.length === 0) return null;
  return { file: fileRel, count: hits.length, hits: hits.slice(0, 40) };
}

async function main() {
  if (process.argv.includes('--fix')) {
    await runFixFromManifest();
    return;
  }

  const files = [];
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d);
    try {
      await fs.access(abs);
    } catch {
      continue;
    }
    await walk(abs, files);
  }

  const report = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const src = await fs.readFile(abs, 'utf8');
    const block = extractCandidates(src, rel);
    if (block) report.push(block);
  }

  report.sort((a, b) => b.count - a.count);

  const json = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalFilesScanned: files.length,
      filesWithHits: report.length,
      top: report.slice(0, 200),
    },
    null,
    2
  );

  if (process.argv.includes('--json')) {
    console.log(json);
  } else {
    console.log(`Fichiers scannés : ${files.length}`);
    console.log(`Fichiers avec candidats : ${report.length} (heuristique français / longues chaînes)\n`);
    for (const r of report.slice(0, 30)) {
      console.log(`${r.file} (${r.count})`);
      for (const h of r.hits.slice(0, 3)) {
        console.log(`  L${h.line}: ${JSON.stringify(h.sample)}`);
      }
    }
    if (report.length > 30) console.log(`\n… ${report.length - 30} fichiers supplémentaires (utilisez --json)`);
    console.log('\nAucune modification disque. Pour la liste complète : node scripts/babel-clean.mjs --json');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
