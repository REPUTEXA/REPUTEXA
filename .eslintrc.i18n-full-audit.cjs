/* eslint-disable @typescript-eslint/no-require-imports -- ESLint config */
/**
 * Audit niveau 2 : premier override en mode `all` (filet), puis parité prod `jsx-only` pour
 * `lib/`, `components/` et `app/` — aligné sur `.eslintrc.cjs` pour éviter le bruit hors UI.
 * Usage : npx eslint -c .eslintrc.i18n-full-audit.cjs app components lib …
 */
const base = require('./.eslintrc.cjs');
const i18nDefaults = require('eslint-plugin-i18next/lib/options/defaults');

const next = {
  ...base,
  overrides: base.overrides.map((o) => {
    if (!o.rules || !o.rules['i18next/no-literal-string']) return o;
    const rule = o.rules['i18next/no-literal-string'];
    const opts = Array.isArray(rule) ? rule[1] : {};
    return {
      ...o,
      rules: {
        ...o.rules,
        'i18next/no-literal-string': [
          'error',
          {
            ...opts,
            mode: 'all',
            message:
              'Chaîne en dur : utiliser messages/*.json + useTranslations / getTranslations (ou pack serveur).',
            words: {
              ...(opts.words || i18nDefaults.words),
              exclude: [
                ...(opts.words?.exclude || i18nDefaults.words.exclude),
                '^use client$',
                '^use server$',
                // Next.js App Router — segment config & runtime (pas du copy utilisateur)
                '^force-dynamic$',
                '^force-static$',
                '^error$',
                '^nodejs$',
                '^edge$',
                // MIME / formats techniques fréquents en API
                '^application/pdf$',
                '^application/json$',
                '^text/csv;charset=utf-8$',
                '^private, no-store$',
                '^no-store$',
              ],
            },
            callees: {
              ...(opts.callees || i18nDefaults.callees),
              exclude: [
                ...(opts.callees?.exclude || i18nDefaults.callees.exclude),
                // Identifiants techniques (Supabase / Prisma) — motifs suffixe (voir generateFullMatchRegExp)
                'from',
                'select',
                'eq',
                'neq',
                'gt',
                'gte',
                'lt',
                'lte',
                'like',
                'ilike',
                'contains',
                'not',
                'or',
                'and',
                'filter',
                'match',
                'order',
                'limit',
                'range',
                'single',
                'maybeSingle',
                'insert',
                'update',
                'upsert',
                'delete',
                'rpc',
                '$queryRaw',
                '$executeRaw',
                'createServerTranslator',
                'billingErrorJson',
                'billingAwareErrorResponse',
                'tmUnauth',
                'tmCookie',
              ],
            },
          },
        ],
      },
    };
  }),
};

const jsxOnlyI18nRule = base.overrides[0].rules['i18next/no-literal-string'];

/**
 * Parité prod : le mode `all` du premier override sert de filet pour les chemins non listés
 * ci-dessous ; `app/`, `lib/` et `components/` reprennent exactement la règle `jsx-only` de
 * `.eslintrc.cjs` (copy dans JSX / attributs, pas les littéraux techniques hors UI).
 */
module.exports = {
  ...next,
  overrides: [
    ...next.overrides,
    {
      files: ['lib/**/*.ts', 'lib/**/*.tsx'],
      rules: {
        'i18next/no-literal-string': jsxOnlyI18nRule,
      },
    },
    {
      files: ['components/**/*.ts', 'components/**/*.tsx'],
      rules: {
        'i18next/no-literal-string': jsxOnlyI18nRule,
      },
    },
    {
      files: ['app/**/*.ts', 'app/**/*.tsx'],
      rules: {
        'i18next/no-literal-string': jsxOnlyI18nRule,
      },
    },
  ],
};
