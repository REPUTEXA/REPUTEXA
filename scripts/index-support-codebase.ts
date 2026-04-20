/**
 * Indexe l’intégralité du dépôt (hors exclusions) dans code_kb_chunks (pgvector),
 * incluant **public/docs/** (registre RGPD, kit conformité). À l’exécution du support,
 * les mêmes fichiers sont aussi injectés en tête du RAG (`loadPublicDocsTruthForSupport`) pour
 * priorité « vérité absolue » sans dépendre du seul embedding.
 *
 * Requiert : OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - Local  : lit .env.local puis .env
 * - Vercel : les variables sont injectées dans process.env (pas de .env.local)
 *
 * Comportement :
 *   Variables manquantes  → exit 0 (build Next.js continue)
 *   Erreur API / réseau   → exit 1 (le déploiement Vercel échoue)
 *
 * Usage : npm run support:index-codebase
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const ROOT = path.resolve(__dirname, '..');

/** Dossiers ignorÃ©s Ã  nâ€™importe quelle profondeur */
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'out',
  'htmlcov',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  '.turbo',
  '.vercel',
  // caches / artefacts locaux
  '.cursor',
]);

/** Fichiers ou motifs exclus (secrets, locks lourds, binaires courants) */
const SKIP_FILE_BASENAMES = new Set([
  '.DS_Store',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

function mustSkipEnvFile(base: string): boolean {
  if (base === '.env.example' || base === '.env.sample') return false;
  if (base === '.env' || base.startsWith('.env.')) return true;
  return false;
}

const EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
  '.mdx',
  '.json',
  '.sql',
  '.yml',
  '.yaml',
  '.py',
  '.css',
  '.scss',
  '.html',
  '.toml',
  '.rs',
  '.go',
  '.sh',
  '.prisma',
  /** Kit conformité public (sous-traitants, etc.) — vectorisé avec le reste du dépôt */
  '.csv',
]);

const MAX_FILE_BYTES = 800_000;

async function walkProjectFiles(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIR_NAMES.has(e.name)) continue;

    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkProjectFiles(full, out);
      continue;
    }

    if (SKIP_FILE_BASENAMES.has(e.name)) continue;
    if (mustSkipEnvFile(e.name)) continue;

    const ext = path.extname(e.name);
    if (!EXT.has(ext)) continue;

    out.push(full);
  }
}

function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oKey = process.env.OPENAI_API_KEY;
  if (!url || !key || !oKey) {
    const missing = [
      !url  && 'NEXT_PUBLIC_SUPABASE_URL',
      !key  && 'SUPABASE_SERVICE_ROLE_KEY',
      !oKey && 'OPENAI_API_KEY',
    ].filter(Boolean).join(', ');
    console.warn(`[support-kb] Variables manquantes : ${missing}`);
    console.warn('[support-kb] Indexation ignorÃ©e â€” le build Next.js continue sans mise Ã  jour de la base de connaissances.');
    process.exit(0);
  }

  const admin = createClient(url, key);
  const openai = new OpenAI({ apiKey: oKey });

  const { error: truncErr } = await admin.rpc('admin_truncate_code_kb');
  if (truncErr) {
    console.error('Truncate code_kb:', truncErr);
    process.exit(1);
  }

  const files: string[] = [];
  await walkProjectFiles(ROOT, files);
  files.sort();

  console.log(`Vectorizer : ${files.length} fichiers Ã©ligibles sous ${ROOT}`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1600,
    chunkOverlap: 200,
  });

  type Row = {
    file_path: string;
    chunk_index: number;
    content: string;
    embedding: string;
  };
  const rows: Row[] = [];

  let processed = 0;
  for (const abs of files) {
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;

    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    let raw: string;
    try {
      raw = await fs.readFile(abs, 'utf8');
    } catch {
      continue;
    }

    const chunks = await splitter.splitText(raw);
    for (let i = 0; i < chunks.length; i++) {
      const piece = chunks[i].trim();
      if (!piece) continue;
      const emb = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: piece.slice(0, 8000),
      });
      const v = emb.data[0]?.embedding;
      if (!v?.length) throw new Error('embedding vide');
      rows.push({
        file_path: rel,
        chunk_index: i,
        content: piece,
        embedding: toVectorLiteral(v),
      });
    }
    processed++;
    if (processed % 25 === 0) {
      console.log(`â€¦ ${processed}/${files.length} fichiers dÃ©coupÃ©s, ${rows.length} chunks`);
    }
  }

  const batchSize = 40;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await admin.from('code_kb_chunks').insert(batch);
    if (error) {
      console.error('Insert batch', i, error);
      process.exit(1);
    }
    console.log(`InsÃ©rÃ© ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }

  console.log('TerminÃ© â€”', rows.length, 'vecteurs dans code_kb_chunks');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

