/**
 * Traduit un sous-arbre Dashboard (messages/fr.json → messages/ja.json) via le pipeline Babel.
 * Usage : npx tsx scripts/babel-dashboard-subtree.ts establishments
 */
import { config as loadEnv } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { transcreateMessageChunk } from '../lib/babel/transcreate-chunk';

async function main() {
  loadEnv({ path: '.env.local' });
  loadEnv();
  const child = process.argv[2]?.trim();
  if (!child) {
    console.error('Usage: npx tsx scripts/babel-dashboard-subtree.ts <DashboardChildKey>');
    process.exit(1);
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENAI_API_KEY manquant.');
    process.exit(1);
  }

  const root = process.cwd();
  const fr = JSON.parse(await readFile(path.join(root, 'messages', 'fr.json'), 'utf8')) as {
    Dashboard: Record<string, unknown>;
  };
  const jaPath = path.join(root, 'messages', 'ja.json');
  const ja = JSON.parse(await readFile(jaPath, 'utf8')) as {
    Dashboard: Record<string, unknown>;
  };

  if (!fr.Dashboard?.[child]) {
    console.error(`Clé Dashboard.${child} absente dans fr.json`);
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey, timeout: 1_800_000, maxRetries: 1 });
  const chunk = { [child]: fr.Dashboard[child] };
  const out = await transcreateMessageChunk({
    openai,
    targetLocaleCode: 'ja',
    targetLabel: 'JA',
    chunk,
  });
  const translated = (out as Record<string, unknown>)[child];
  if (translated === undefined) {
    console.error('Réponse IA sans clé attendue');
    process.exit(1);
  }
  ja.Dashboard = ja.Dashboard ?? {};
  ja.Dashboard[child] = translated;
  await writeFile(jaPath, `${JSON.stringify(ja, null, 2)}\n`, 'utf8');
  console.log(`[babel-dashboard-subtree] OK Dashboard.${child}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
