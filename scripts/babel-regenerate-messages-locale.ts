/**
 * Régénère un fichier messages/{locale}.json à partir de messages/fr.json via le pipeline
 * transcreateMessageChunk (Native-Perfect : contexte produit, glossaire, auto-critique).
 *
 * Usage :
 *   npx tsx scripts/babel-regenerate-messages-locale.ts it
 *   npx tsx scripts/babel-regenerate-messages-locale.ts it --batch-size=2 --max-batches=3
 *   npx tsx scripts/babel-regenerate-messages-locale.ts it --root-key=Pdf --max-batches=1   (démo rapide)
 *   npx tsx scripts/babel-regenerate-messages-locale.ts it --resume   (reprendre après crash via tmp/.babel-regenerate-progress-{locale}.json)
 *
 * Prérequis : OPENAI_API_KEY dans l’environnement (ex. .env.local via dotenv).
 */

import { config as loadEnv } from 'dotenv';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { transcreateMessageChunk, mergeDraftMessages } from '../lib/babel/transcreate-chunk';

function parseArgs(argv: string[]) {
  const locale = argv[2]?.trim().toLowerCase();
  let batchSize = 2;
  let maxBatches: number | null = null;
  let inPlacePartial = false;
  let rootKeyFilter: string | null = null;
  let resume = false;
  let noCritique = false;
  for (const a of argv.slice(3)) {
    if (a.startsWith('--batch-size=')) batchSize = Math.max(1, parseInt(a.split('=')[1] ?? '2', 10) || 2);
    if (a.startsWith('--max-batches=')) maxBatches = Math.max(1, parseInt(a.split('=')[1] ?? '1', 10) || 1);
    if (a.startsWith('--root-key=')) rootKeyFilter = (a.split('=')[1] ?? '').trim();
    if (a === '--in-place' || a === '--in-place-partial') inPlacePartial = true;
    if (a === '--resume') resume = true;
    if (a === '--no-critique') noCritique = true;
  }
  return { locale, batchSize, maxBatches, inPlacePartial, rootKeyFilter, resume, noCritique };
}

/** Traduit un chunk ; en cas d’échec, divise le lot jusqu’à une clé (résilience JSON / taille). */
async function transcreateChunkResilient(
  openai: OpenAI,
  locale: string,
  chunk: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const keys = Object.keys(chunk);
  if (keys.length === 0) return {};
  try {
    return await transcreateMessageChunk({
      openai,
      targetLocaleCode: locale,
      targetLabel: locale.toUpperCase(),
      chunk,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout =
      msg.includes('timed out') || msg.includes('timeout') || msg.includes('ETIMEDOUT');
    if (keys.length === 1) {
      if (isTimeout) {
        console.error(
          '[babel-regenerate] Timeout sur une seule clé volumineuse — minimum appliqué côté script 1 800 000 ms ; sinon découpage sous-arbres.'
        );
      }
      const onlyKey = keys[0]!;
      const onlyVal = chunk[onlyKey];
      if (
        onlyVal != null &&
        typeof onlyVal === 'object' &&
        !Array.isArray(onlyVal) &&
        Object.keys(onlyVal as Record<string, unknown>).length > 1
      ) {
        const sub = onlyVal as Record<string, unknown>;
        const subKeys = Object.keys(sub);
        const mid = Math.ceil(subKeys.length / 2);
        const partA: Record<string, unknown> = {};
        const partB: Record<string, unknown> = {};
        for (let i = 0; i < subKeys.length; i++) {
          const sk = subKeys[i]!;
          if (i < mid) partA[sk] = sub[sk];
          else partB[sk] = sub[sk];
        }
        console.warn(
          `[babel-regenerate] Clé volumineuse « ${onlyKey} » — division en 2 sous-arbres (${mid} + ${subKeys.length - mid} clés).`
        );
        const outA = await transcreateChunkResilient(openai, locale, { [onlyKey]: partA });
        const outB = await transcreateChunkResilient(openai, locale, { [onlyKey]: partB });
        return mergeDraftMessages(outA, outB);
      }
      throw e;
    }
    const mid = Math.ceil(keys.length / 2);
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      if (i < mid) a[k] = chunk[k];
      else b[k] = chunk[k];
    }
    console.warn(`[babel-regenerate] Échec lot [${keys.join(', ')}] — division en 2 sous-lots.`);
    const partA = await transcreateChunkResilient(openai, locale, a);
    const partB = await transcreateChunkResilient(openai, locale, b);
    return mergeDraftMessages(partA, partB);
  }
}

async function main() {
  loadEnv({ path: '.env.local' });
  loadEnv();

  const { locale, batchSize, maxBatches, inPlacePartial, rootKeyFilter, resume, noCritique } =
    parseArgs(process.argv);
  if (!locale) {
    console.error(
      'Usage: npx tsx scripts/babel-regenerate-messages-locale.ts <locale> [--batch-size=N] [--max-batches=N] [--root-key=Pdf] [--in-place-partial] [--resume] [--no-critique]'
    );
    process.exit(1);
  }
  if (noCritique) {
    process.env.BABEL_NATIVE_CRITIQUE_ENABLED = '0';
    console.warn('[babel-regenerate] Auto-critique désactivée pour cette exécution (--no-critique).');
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENAI_API_KEY manquant.');
    process.exit(1);
  }

  const root = process.cwd();
  const frPath = path.join(root, 'messages', 'fr.json');
  const fullOutPath = path.join(root, 'messages', `${locale}.json`);
  const raw = await readFile(frPath, 'utf8');
  const fr = JSON.parse(raw) as Record<string, unknown>;
  let allKeys = Object.keys(fr).sort();
  if (rootKeyFilter) {
    if (!allKeys.includes(rootKeyFilter)) {
      console.error(`Clé racine inconnue : ${rootKeyFilter}`);
      process.exit(1);
    }
    allKeys = [rootKeyFilter];
  }
  const timeoutMs = Math.max(
    1_800_000,
    Number(process.env.BABEL_OPENAI_TIMEOUT_MS?.trim()) || 0
  );
  const openai = new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 1,
  });
  const progressPath = path.join(root, 'tmp', `.babel-regenerate-progress-${locale}.json`);

  let merged: Record<string, unknown> = {};
  if (!resume && !rootKeyFilter) {
    try {
      await unlink(progressPath);
    } catch {
      /* pas de fichier */
    }
  }
  if (resume && !rootKeyFilter) {
    try {
      merged = JSON.parse(await readFile(progressPath, 'utf8')) as Record<string, unknown>;
      console.log(`[babel-regenerate] Reprise : ${Object.keys(merged).length} clés racine déjà dans ${progressPath}`);
    } catch {
      console.warn(`[babel-regenerate] --resume : fichier progression absent, départ vide.`);
    }
  }

  let pending = allKeys.filter((k) => !(k in merged));
  let batchesRun = 0;
  let stoppedPartial = false;

  while (pending.length > 0) {
    if (maxBatches != null && batchesRun >= maxBatches) {
      console.warn(
        `[babel-regenerate] Limite --max-batches=${maxBatches} atteinte ; sortie partielle (${Object.keys(merged).length}/${allKeys.length} clés racine).`
      );
      stoppedPartial = true;
      break;
    }

    let batch = pending.slice(0, batchSize);
    let chunk: Record<string, unknown> = {};
    for (const k of batch) chunk[k] = fr[k]!;
    while (JSON.stringify(chunk).length > 120_000 && batch.length > 1) {
      batch = batch.slice(0, batch.length - 1);
      chunk = {};
      for (const k of batch) chunk[k] = fr[k]!;
    }

    const translated = await transcreateChunkResilient(openai, locale, chunk);
    merged = mergeDraftMessages(merged, translated);
    pending = pending.filter((k) => !batch.includes(k));
    batchesRun += 1;
    console.log(`[babel-regenerate] Lot ${batchesRun} : ${batch.join(', ')}`);

    if (!rootKeyFilter && !stoppedPartial) {
      await mkdir(path.dirname(progressPath), { recursive: true });
      await writeFile(progressPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    }
  }

  if (stoppedPartial && !inPlacePartial) {
    const partialOut = path.join(root, 'tmp', `babel-regenerate-partial-${locale}.json`);
    await mkdir(path.dirname(partialOut), { recursive: true });
    await writeFile(partialOut, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    console.log(
      `Écrit (extrait démo, sans écraser messages/) : ${partialOut} — sans --max-batches pour une régénération complète, ou --in-place-partial pour écraser messages/${locale}.json.`
    );
    process.exit(0);
  }

  let toWrite: Record<string, unknown> = merged;
  if (rootKeyFilter) {
    let base: Record<string, unknown> = {};
    try {
      base = JSON.parse(await readFile(fullOutPath, 'utf8')) as Record<string, unknown>;
    } catch {
      console.warn(`[babel-regenerate] Fichier ${fullOutPath} absent ou invalide — base vide pour fusion --root-key.`);
    }
    toWrite = mergeDraftMessages(base, merged);
  }

  await writeFile(fullOutPath, `${JSON.stringify(toWrite, null, 2)}\n`, 'utf8');
  if (!rootKeyFilter) {
    try {
      await unlink(progressPath);
    } catch {
      /* ok */
    }
  }
  console.log(
    rootKeyFilter
      ? `Fusionné dans : ${fullOutPath} (clés mises à jour : ${Object.keys(merged).join(', ')})`
      : `Écrit : ${fullOutPath} (${Object.keys(merged).length} clés racine)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
