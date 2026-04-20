import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SITE_LOCALE_CODES, SITE_LOCALE_META } from '@/lib/i18n/site-locales-catalog';

type Variant = 'full' | 'compact';

function RequiredBadge({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex shrink-0 rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300/90">
      {label}
    </span>
  );
}

function OptionalBadge({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex shrink-0 rounded-full border border-zinc-600 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
      {label}
    </span>
  );
}

/**
 * Manual roadmap: nothing is automatic unless you choose the AI Expansion tool.
 * Replace xx in paths with your locale code (e.g. ko, nl).
 */
export async function BabelLanguagePlaybook({ variant }: { variant: Variant }) {
  const t = await getTranslations('Dashboard.adminBabelPlaybook');
  const tRich = t.rich;
  const tLocale = await getTranslations('Dashboard.establishments.localeName');

  const mono = (chunks: ReactNode) => <code className="text-zinc-400">{chunks}</code>;
  const monoSlate = (chunks: ReactNode) => <code className="text-slate-500">{chunks}</code>;
  const bZinc = (chunks: ReactNode) => <strong className="text-zinc-200">{chunks}</strong>;
  const bSlate = (chunks: ReactNode) => <strong className="text-slate-300">{chunks}</strong>;

  if (variant === 'compact') {
    return (
      <section className="rounded-2xl border border-slate-600/40 bg-slate-950/40 px-4 py-4 text-sm text-slate-200">
        <p className="font-medium text-slate-100">{t('compactTitle')}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {tRich('compactP1', {
            b: bSlate,
            code: monoSlate,
          })}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/dashboard/admin/babel-guardian/wizard"
            className="inline-flex text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            {t('compactLinkWizard')}
          </Link>
          <Link
            href="/dashboard/admin/babel-guardian"
            className="inline-flex text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            {t('compactLinkSteps')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-700/80 bg-zinc-900/30 px-4 py-4 text-sm leading-relaxed text-zinc-300">
        <p className="font-medium text-zinc-100">{t('panelTitle')}</p>
        <p className="mt-2 text-xs text-zinc-500">
          {t('panelP1Prefix')}{' '}
          <Link href="/dashboard/admin/babel-guardian/wizard" className="text-emerald-400 hover:text-emerald-300">
            {t('linkWizard')}
          </Link>
          {t('panelP1Suffix')}
        </p>
        <ul className="mt-3 list-inside list-disc space-y-2 text-zinc-400">
          <li>{tRich('bullet1', { b: bZinc })}</li>
          <li>{tRich('bullet2', { b: bZinc })}</li>
          <li>{tRich('bullet3', { b: bZinc })}</li>
          <li>
            <strong className="text-zinc-200">{t('bullet4Part1')}</strong>{' '}
            <code className="text-zinc-500">{t('codeNpmBabelClean')}</code>{' '}
            {t('bullet4Part2')}{' '}
            <code className="text-zinc-500">{t('pathBabelCleanManifest')}</code>{' '}
            {t('bullet4Part3')}{' '}
            <code className="text-zinc-500">{t('codeBabelCleanFix')}</code>{' '}
            {t('bullet4Part4')}{' '}
            <code className="text-zinc-500">{t('pathBabelCleanExample')}</code>
            {t('bullet4Part5')}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">{t('catalogTitle')}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SITE_LOCALE_CODES.map((code) => (
            <li
              key={code}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400"
            >
              <span className="font-mono text-indigo-300">{code}</span>
              <span className="mx-1.5 text-zinc-600">·</span>
              {tLocale(code)}
              {SITE_LOCALE_META[code].gateCountryCode ? (
                <span className="mt-1 block text-[11px] text-zinc-500">
                  {t('catalogGateLine', {
                    code,
                    country: SITE_LOCALE_META[code].gateCountryCode ?? '',
                  })}
                </span>
              ) : (
                <span className="mt-1 block text-[11px] text-zinc-600">{t('catalogAlwaysPublic')}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">{t('newLangTitle')}</h2>
        <p className="text-xs text-zinc-500">{t('newLangIntro')}</p>

        <ol className="space-y-4">
          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">1</span>
              <span className="text-sm font-medium text-zinc-200">{t('step01_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step01_p1', { mono })}</p>
            <p className="mt-2 text-[11px] text-zinc-600">{tRich('step01_p2', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">2</span>
              <span className="text-sm font-medium text-zinc-200">{t('step02_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step02_p1', { mono })}</p>
            <p className="mt-2 text-[11px] text-zinc-600">
              {t('step02_p2a')}{' '}
              <Link href="/dashboard/admin/babel-guardian/expansion" className="text-indigo-400 hover:text-indigo-300">
                {t('step02_linkExpansion')}
              </Link>{' '}
              {tRich('step02_p2b', { mono })}
            </p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">3</span>
              <span className="text-sm font-medium text-zinc-200">{t('step03_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {t('step03_p1a')}{' '}
              <code className="text-zinc-400">{t('step03_codeImport')}</code>{' '}
              {tRich('step03_p1b', { mono })}
            </p>
            <p className="mt-2 text-[11px] text-zinc-600">{t('step03_p2')}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">4</span>
              <span className="text-sm font-medium text-zinc-200">{t('step04_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step04_p1', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">5</span>
              <span className="text-sm font-medium text-zinc-200">{t('step05_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step05_p1', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">6</span>
              <span className="text-sm font-medium text-zinc-200">{t('step06_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step06_p1', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">7</span>
              <span className="text-sm font-medium text-zinc-200">{t('step07_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step07_p1', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">8</span>
              <span className="text-sm font-medium text-zinc-200">{t('step08_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step08_p1', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">9</span>
              <span className="text-sm font-medium text-zinc-200">{t('step09_title')}</span>
              <OptionalBadge label={t('badgeOptional')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {t('step09_p1a')}{' '}
              <Link href="/dashboard/admin/growth-war-room" className="text-indigo-400 hover:text-indigo-300">
                {t('step09_linkWarRoom')}
              </Link>{' '}
              {tRich('step09_p1b', { mono })}
            </p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">10</span>
              <span className="text-sm font-medium text-zinc-200">{t('step10_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step10_p1', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">11</span>
              <span className="text-sm font-medium text-zinc-200">{t('step11_title')}</span>
              <OptionalBadge label={t('badgeOptional')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step11_p1', { mono })}</p>
          </li>

          <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-violet-400">12</span>
              <span className="text-sm font-medium text-zinc-200">{t('step12_title')}</span>
              <RequiredBadge label={t('badgeRequiredNative')} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tRich('step12_p1', { mono })}</p>
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-4 text-xs leading-relaxed text-emerald-100/85">
        <p className="font-medium text-emerald-200">{t('footerTitle')}</p>
        <p className="mt-2 text-emerald-100/70">{tRich('footerP1', { mono })}</p>
      </section>
    </div>
  );
}
