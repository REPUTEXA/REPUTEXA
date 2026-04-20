/**
 * 1) Aligne toutes les locales sur la structure de messages/fr.json (merge profond).
 * 2) Régénère chaque fichier via le pipeline Babel (transcréation experte depuis le FR).
 *
 * Usage :
 *   npx tsx scripts/babel-regenerate-all-site-locales.ts
 *   npx tsx scripts/babel-regenerate-all-site-locales.ts --sync-only
 *   npx tsx scripts/babel-regenerate-all-site-locales.ts --babel-only
 *   npx tsx scripts/babel-regenerate-all-site-locales.ts --locales=de,it
 *   npx tsx scripts/babel-regenerate-all-site-locales.ts --batch-size=2 --critique
 *   npx tsx scripts/babel-regenerate-all-site-locales.ts --babel-only --resume --locales=en
 *
 * Prérequis : OPENAI_API_KEY (ex. .env.local)
 */
import { config as loadEnv } from 'dotenv';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { mergeMessagesDeep } from '../lib/i18n/merge-messages-deep';
import { SITE_LOCALE_CODES } from '../lib/i18n/site-locales-catalog';

function parseLocalesArg(argv: string[]): string[] | null {
  const raw = argv.find((a) => a.startsWith('--locales='))?.split('=')[1]?.trim();
  if (!raw) return null;
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseBatchSize(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith('--batch-size='))?.split('=')[1]?.trim();
  const n = raw ? parseInt(raw, 10) : 2;
  return Math.max(1, Number.isFinite(n) ? n : 2);
}

async function main() {
  loadEnv({ path: '.env.local' });
  loadEnv();

  const argv = process.argv.slice(2);
  const syncOnly = argv.includes('--sync-only');
  const babelOnly = argv.includes('--babel-only');
  const useCritique = argv.includes('--critique');
  const resume = argv.includes('--resume');
  const batchSize = parseBatchSize(process.argv);
  const filterLocales = parseLocalesArg(process.argv);

  const root = process.cwd();
  const frPath = path.join(root, 'messages', 'fr.json');
  const fr = JSON.parse(readFileSync(frPath, 'utf8')) as Record<string, unknown>;

  let locales = SITE_LOCALE_CODES.filter((l) => l !== 'fr');
  if (filterLocales?.length) {
    locales = locales.filter((l) => filterLocales.includes(l));
  }

  if (!babelOnly) {
    for (const locale of locales) {
      const p = path.join(root, 'messages', `${locale}.json`);
      const loc = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
      const merged = mergeMessagesDeep(fr, loc);
      writeFileSync(p, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
      console.log(`[all-locales] sync ${locale}.json → ${Object.keys(merged).length} racines`);
    }
  }

  if (syncOnly) {
    console.log('[all-locales] sync-only terminé.');
    return;
  }

  for (const locale of locales) {
    console.log(`\n${'='.repeat(72)}\n[all-locales] BABEL → ${locale} (batch-size=${batchSize}${useCritique ? ', critique' : ', no-critique'}${resume ? ', resume' : ''})\n${'='.repeat(72)}\n`);
    const parts = [
      'npx tsx scripts/babel-regenerate-messages-locale.ts',
      locale,
      `--batch-size=${batchSize}`,
    ];
    if (!useCritique) parts.push('--no-critique');
    if (resume) parts.push('--resume');
    const childEnv = { ...process.env };
    if (!useCritique) childEnv.BABEL_NATIVE_CRITIQUE_ENABLED = '0';
    execSync(parts.join(' '), {
      stdio: 'inherit',
      cwd: root,
      env: childEnv,
    });
  }

  console.log('\n[all-locales] Terminé pour :', locales.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
