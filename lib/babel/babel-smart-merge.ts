import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { mkdir } from 'fs/promises';
import { extractSnippetFromMd } from '@/lib/babel/extract-snippet-from-md';

const LOCALE_RE = /^[a-z]{2}(-[a-z]{2,4})?$/;

/** Ancres committées dans le repo — injection avant repli regex hérité */
const ANCHOR_SITE_META = '/* @babel-anchor site-locale-meta-insert */';
const ANCHOR_PACK_IMPORT = '/* @babel-anchor server-pack-import-insert */';
const ANCHOR_PACK_RAW = '/* @babel-anchor server-pack-raw-insert */';
const ANCHOR_SIGNUP = '/* @babel-anchor signup-locale-insert */';
const ANCHOR_SEO = '/* @babel-anchor seo-config-insert */';

export type SmartMergeResult = {
  ok: boolean;
  files: { path: string; action: 'updated' | 'skipped' | 'error'; detail?: string }[];
  errors: string[];
  /** Chemins relatifs repo pour git add */
  gitPaths: string[];
};

function rel(projectRoot: string, abs: string) {
  return path.relative(projectRoot, abs).split(path.sep).join('/');
}

async function readTmpSnippet(projectRoot: string, locale: string, name: string): Promise<string | null> {
  const p = path.join(projectRoot, 'tmp', 'babel-wizard-apply', locale, name);
  try {
    const raw = await readFile(p, 'utf8');
    return extractSnippetFromMd(raw);
  } catch {
    return null;
  }
}

function parseMetaLineFromCatalogSnippet(snippet: string, locale: string): string {
  const re = new RegExp(`${locale}\\s*:\\s*\\{[\\s\\S]*?\\}\\s*,?`, 'm');
  const m = snippet.match(re);
  if (m) return m[0].replace(/,\s*$/, '');
  const gate = 'null';
  return `${locale}: { labelFr: '${locale.toUpperCase()} (auto)', gateCountryCode: ${gate} }`;
}

export function mergeSiteLocalesCatalog(source: string, locale: string, catalogMdSnippet: string): string {
  if (!LOCALE_RE.test(locale)) throw new Error('locale invalide');

  const codesM = source.match(/export const SITE_LOCALE_CODES = \[([^\]]*)\] as const/);
  if (!codesM) throw new Error('SITE_LOCALE_CODES introuvable');

  const codes = [...codesM[1].matchAll(/'([a-z]{2}(?:-[a-z]{2,4})?)'/g)].map((x) => x[1]);
  if (!codes.includes(locale)) {
    codes.push(locale);
    codes.sort();
    const arr = codes.map((c) => `'${c}'`).join(', ');
    source = source.replace(codesM[0], `export const SITE_LOCALE_CODES = [${arr}] as const`);
  }

  if (source.includes(`${locale}: { labelFr:`)) {
    return source;
  }

  const metaLine = parseMetaLineFromCatalogSnippet(catalogMdSnippet, locale).replace(/,\s*$/, '');

  if (source.includes(ANCHOR_SITE_META)) {
    if (source.includes(`${locale}: { labelFr:`)) return source;
    return source.replace(ANCHOR_SITE_META, `  ${metaLine},\n  ${ANCHOR_SITE_META}`);
  }

  const marker = '\n\n/** Locales « expansion »';
  const mi = source.indexOf(marker);
  if (mi === -1) throw new Error('Fin de SITE_LOCALE_META introuvable (marker War Room)');

  const head = source.slice(0, mi);
  const tail = source.slice(mi);
  const closeIdx = head.lastIndexOf('\n};');
  if (closeIdx === -1) throw new Error('Fermeture SITE_LOCALE_META introuvable');

  const before = head.slice(0, closeIdx);
  const after = head.slice(closeIdx);
  return before + '\n  ' + metaLine + ',' + after + tail;
}

export function mergeSignupUiByLocale(source: string, locale: string, signupSnippet: string): string {
  if (!LOCALE_RE.test(locale)) throw new Error('locale invalide');
  const marker = '\n\nexport function getSignupUi';
  const mi = source.indexOf(marker);
  if (mi === -1) throw new Error('export function getSignupUi introuvable');

  const head = source.slice(0, mi);
  const tail = source.slice(mi);
  const block = signupSnippet.trim().replace(/^,\s*/, '');
  if (!block.startsWith(`${locale}:`)) {
    throw new Error(`Le snippet signup doit commencer par "${locale}:"`);
  }
  const lines = block.split('\n').map((l) => (l.length ? `  ${l}` : l));
  const padded = lines.join('\n');

  if (head.includes(ANCHOR_SIGNUP)) {
    if (head.includes(`${locale}:`)) return head + tail;
    return head.replace(`  ${ANCHOR_SIGNUP}`, `  ${padded},\n  ${ANCHOR_SIGNUP}`) + tail;
  }

  const toFind = /\n  \},\n\};$/;
  if (!toFind.test(head)) throw new Error('Fermeture de BY { … }; introuvable (signup-ui-by-locale)');

  return head.replace(toFind, `,\n${padded},\n};`) + tail;
}

export function mergeSeoConfig(source: string, locale: string, seoSnippet: string): string {
  if (!LOCALE_RE.test(locale)) throw new Error('locale invalide');
  const marker = '\n\nexport function generateStaticParams';
  const mi = source.indexOf(marker);
  if (mi === -1) throw new Error('generateStaticParams introuvable');

  const head = source.slice(0, mi);
  const tail = source.slice(mi);
  let block = seoSnippet.trim().replace(/^,\s*/, '');
  if (!block.startsWith(`${locale}:`)) {
    const inner = block.match(/\{\s*title:\s*[\s\S]+?description:\s*[\s\S]+?\}/);
    if (inner) block = `${locale}: ${inner[0]},`;
    else throw new Error(`Snippet SEO : préfixer par "${locale}:" ou fournir { title, description }`);
  }
  const lines = block.split('\n').map((l) => (l.length ? `  ${l}` : l));
  const padded = lines.join('\n');

  if (head.includes(ANCHOR_SEO)) {
    if (head.includes(`${locale}:`)) return head + tail;
    return head.replace(`  ${ANCHOR_SEO}`, `  ${padded},\n  ${ANCHOR_SEO}`) + tail;
  }

  const toFind = /\n  \},\n\};$/;
  if (!toFind.test(head)) throw new Error('Fermeture SEO_CONFIG introuvable');

  return head.replace(toFind, `,\n${padded},\n};`) + tail;
}

export function mergeServerLocaleMessagePack(source: string, locale: string, _packSnippet: string): string {
  if (!LOCALE_RE.test(locale)) throw new Error('locale invalide');
  if (source.includes(`@/messages/${locale}.json`)) {
    return source;
  }
  const importLine = `import ${locale} from '@/messages/${locale}.json';`;

  if (source.includes(ANCHOR_PACK_IMPORT)) {
    let s = source.replace(ANCHOR_PACK_IMPORT, `${importLine}\n${ANCHOR_PACK_IMPORT}`);
    if (s.includes(ANCHOR_PACK_RAW) && !s.includes(`  ${locale}: ${locale} as unknown`)) {
      const rawLine = `  ${locale}: ${locale} as unknown as Record<string, unknown>,`;
      s = s.replace(ANCHOR_PACK_RAW, `${rawLine}\n  ${ANCHOR_PACK_RAW}`);
    }
    return s;
  }

  const zhImport = `import zh from '@/messages/zh.json';`;
  const zi = source.indexOf(zhImport);
  if (zi === -1) throw new Error('import zh messages introuvable');
  const lineEnd = source.indexOf('\n', zi);
  const s = source.slice(0, lineEnd + 1) + importLine + '\n' + source.slice(lineEnd + 1);

  const anchor = '  zh: zh as unknown as Record<string, unknown>,';
  const ai = s.indexOf(anchor);
  if (ai === -1) throw new Error('entrée zh dans rawByLocale introuvable');
  if (s.includes(`  ${locale}: ${locale} as unknown`)) return s;
  const insert = `\n  ${locale}: ${locale} as unknown as Record<string, unknown>,`;
  return s.slice(0, ai + anchor.length) + insert + s.slice(ai + anchor.length);
}

async function writeEmailStubs(projectRoot: string, locale: string, label: string) {
  const dir = path.join(projectRoot, 'emails', locale);
  await mkdir(dir, { recursive: true });
  const wrap = (title: string, body: string) =>
    `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"/><title>${title}</title></head><body><p>${body}</p></body></html>\n`;

  await writeFile(path.join(dir, 'onboarding.html'), wrap('Onboarding', `REPUTEXA — ${label} (stub généré Babel).`), 'utf8');
  await writeFile(path.join(dir, 'legal.html'), wrap('Legal', `Mentions / légal — ${label} (stub, à remplacer).`), 'utf8');
  await writeFile(path.join(dir, 'support.html'), wrap('Support', `Support client — ${label} (stub).`), 'utf8');
}

async function writePromptStub(projectRoot: string, locale: string, label: string) {
  const dir = path.join(projectRoot, 'lib', 'i18n', 'prompts');
  await mkdir(dir, { recursive: true });
  const p = path.join(dir, `${locale}.ts`);
  try {
    await readFile(p, 'utf8');
    return;
  } catch {
    /* nouveau */
  }
  const body = `/**
 * Ton & personnalité Nexus / support — ${label}
 * @babel-anchor locale-prompt-profile (smart-merge)
 */
export const localePromptProfile = {
  locale: '${locale}',
  label: ${JSON.stringify(label)},
  /** 0 = très formel, 1 = neutre pro, 2 = chaleureux */
  warmth: 1 as const,
  /** Réponses plus courtes si true */
  concise: false,
  systemHint:
    'Tu es un expert e-réputation pour ce marché. Adapte registre, politesses, exemples d’enseignes et de villes au pays cible. Ne mélange pas les langues.',
  userFacingHint:
    'Réponds dans la langue de la locale ; ton aligné sur warmth/concise.',
} as const;
`;
  await writeFile(p, body, 'utf8');
}

async function mergeValidationHints(projectRoot: string, locale: string) {
  const p = path.join(projectRoot, 'lib', 'i18n', 'locale-validation-hints.ts');
  let src: string;
  try {
    src = await readFile(p, 'utf8');
  } catch {
    src = `/**
 * Indices UX / exemples (pas de validation runtime stricte — utiliser libphonenumber-js dans les formulaires).
 * Étendu par Babel smart-merge.
 */
export const LOCALE_VALIDATION_HINTS: Record<
  string,
  { phonePlaceholder?: string; postalExample?: string }
> = {
};
`;
  }
  if (new RegExp(`['"]${locale.replace(/'/g, "\\'")}['"]\\s*:`).test(src)) {
    await writeFile(p, src, 'utf8');
    return;
  }
  const m = src.match(/(export const LOCALE_VALIDATION_HINTS[\s\S]*?=\s*\{)/);
  if (!m || m.index === undefined) return;
  const idx = m.index + m[1].length;
  const insert = `\n  '${locale}': { phonePlaceholder: '', postalExample: '' },`;
  src = src.slice(0, idx) + insert + src.slice(idx);
  await writeFile(p, src, 'utf8');
}

/**
 * Lit tmp/babel-wizard-apply/{locale}/*.md et fusionne dans les fichiers maîtres.
 * Ordre : catalogue → pack serveur → signup → SEO → stubs emails / prompts / hints.
 */
export async function smartMergeFromTmp(params: {
  projectRoot: string;
  locale: string;
  targetLabel?: string;
  skipEmailStubs?: boolean;
}): Promise<SmartMergeResult> {
  const { projectRoot, locale: lcRaw } = params;
  const locale = lcRaw.trim().toLowerCase();
  const label = params.targetLabel?.trim() || locale.toUpperCase();
  const files: SmartMergeResult['files'] = [];
  const errors: string[] = [];

  if (!LOCALE_RE.test(locale)) {
    return { ok: false, files, errors: ['Code locale invalide'], gitPaths: [] };
  }

  const gitPaths: string[] = [];

  const cat = await readTmpSnippet(projectRoot, locale, '01-catalog.md');
  const pack = await readTmpSnippet(projectRoot, locale, '02-server-locale-message-pack.md');
  const signup = await readTmpSnippet(projectRoot, locale, '03-signup-ui-by-locale.md');
  const seo = await readTmpSnippet(projectRoot, locale, '04-seo-layout.md');

  const catalogPath = path.join(projectRoot, 'lib', 'i18n', 'site-locales-catalog.ts');
  const packPath = path.join(projectRoot, 'lib', 'emails', 'server-locale-message-pack.ts');
  const signupPath = path.join(projectRoot, 'lib', 'i18n', 'signup-ui-by-locale.ts');
  const layoutPath = path.join(projectRoot, 'app', '[locale]', 'layout.tsx');

  try {
    if (cat) {
      const s = await readFile(catalogPath, 'utf8');
      const next = mergeSiteLocalesCatalog(s, locale, cat);
      await writeFile(catalogPath, next, 'utf8');
      const rp = rel(projectRoot, catalogPath);
      files.push({ path: rp, action: 'updated' });
      gitPaths.push(rp);
    } else {
      files.push({ path: '01-catalog.md', action: 'skipped', detail: 'fichier absent ou vide' });
    }

    if (pack) {
      const s = await readFile(packPath, 'utf8');
      const next = mergeServerLocaleMessagePack(s, locale, pack);
      await writeFile(packPath, next, 'utf8');
      const rp = rel(projectRoot, packPath);
      files.push({ path: rp, action: 'updated' });
      gitPaths.push(rp);
    } else {
      files.push({ path: '02-server-locale-message-pack.md', action: 'skipped', detail: 'absent' });
    }

    if (signup) {
      const s = await readFile(signupPath, 'utf8');
      const next = mergeSignupUiByLocale(s, locale, signup);
      await writeFile(signupPath, next, 'utf8');
      const rp = rel(projectRoot, signupPath);
      files.push({ path: rp, action: 'updated' });
      gitPaths.push(rp);
    } else {
      files.push({ path: '03-signup-ui-by-locale.md', action: 'skipped', detail: 'absent' });
    }

    if (seo) {
      const s = await readFile(layoutPath, 'utf8');
      const next = mergeSeoConfig(s, locale, seo);
      await writeFile(layoutPath, next, 'utf8');
      const rp = rel(projectRoot, layoutPath);
      files.push({ path: rp, action: 'updated' });
      gitPaths.push(rp);
    } else {
      files.push({ path: '04-seo-layout.md', action: 'skipped', detail: 'absent' });
    }

    if (!params.skipEmailStubs) {
      await writeEmailStubs(projectRoot, locale, label);
      files.push({ path: `emails/${locale}/*.html`, action: 'updated', detail: 'stubs' });
      gitPaths.push(
        `emails/${locale}/onboarding.html`,
        `emails/${locale}/legal.html`,
        `emails/${locale}/support.html`
      );
    }

    await writePromptStub(projectRoot, locale, label);
    files.push({ path: `lib/i18n/prompts/${locale}.ts`, action: 'updated', detail: 'stub tone' });
    gitPaths.push(`lib/i18n/prompts/${locale}.ts`);

    await mergeValidationHints(projectRoot, locale);
    files.push({ path: 'lib/i18n/locale-validation-hints.ts', action: 'updated', detail: 'hint row' });
    gitPaths.push('lib/i18n/locale-validation-hints.ts');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    files.push({ path: '—', action: 'error', detail: msg });
    return { ok: false, files, errors, gitPaths };
  }

  return { ok: errors.length === 0, files, errors, gitPaths };
}
