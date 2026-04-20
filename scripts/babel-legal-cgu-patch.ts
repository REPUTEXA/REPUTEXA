/**
 * Retraduit les blocs Legal.cgu encore en FR dans messages/ja.json (pipeline Babel).
 */
import { config as loadEnv } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { transcreateMessageChunk } from '../lib/babel/transcreate-chunk';

const KEYS = [
  'responsabilite_title',
  'responsabilite_content',
  'droit_title',
  'droit_content',
  'zenith_obligations_title',
  'zenith_obligations_content',
  'annexe_fidelite_title',
  'annexe_fidelite_content',
  'modifications_content',
  'mediation_title',
  'mediation_content',
  'suspension_title',
  'suspension_content',
  'force_majeure_content',
  'contact_content',
] as const;

async function main() {
  loadEnv({ path: '.env.local' });
  loadEnv();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENAI_API_KEY manquant.');
    process.exit(1);
  }

  const root = process.cwd();
  const fr = JSON.parse(await readFile(path.join(root, 'messages', 'fr.json'), 'utf8')) as {
    Legal: { cgu: Record<string, string> };
  };
  const jaPath = path.join(root, 'messages', 'ja.json');
  const ja = JSON.parse(await readFile(jaPath, 'utf8')) as {
    Legal: { cgu: Record<string, string> };
  };

  const patch: Record<string, unknown> = {};
  for (const k of KEYS) {
    const v = fr.Legal.cgu[k];
    if (typeof v !== 'string') {
      console.error(`fr Legal.cgu.${k} manquant ou non string`);
      process.exit(1);
    }
    patch[k] = v;
  }

  const openai = new OpenAI({ apiKey, timeout: 1_800_000, maxRetries: 1 });
  const out = await transcreateMessageChunk({
    openai,
    targetLocaleCode: 'ja',
    targetLabel: 'JA',
    chunk: patch,
  });

  ja.Legal.cgu = ja.Legal.cgu ?? {};
  for (const k of KEYS) {
    const v = (out as Record<string, unknown>)[k];
    if (typeof v !== 'string') {
      console.error(`Réponse sans chaîne pour ${k}`);
      process.exit(1);
    }
    ja.Legal.cgu[k] = v;
  }

  await writeFile(jaPath, `${JSON.stringify(ja, null, 2)}\n`, 'utf8');
  console.log('[babel-legal-cgu-patch] OK', KEYS.length, 'clés');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
