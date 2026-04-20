import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { ChevronLeft, ChevronRight, Languages, Zap } from 'lucide-react';
import { BabelLanguagePlaybook } from '@/components/admin/babel-language-playbook';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export default async function BabelGuardianPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.adminBabelGuardian' });
  const tNav = await getTranslations({ locale, namespace: 'Dashboard.adminNav' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect(`/${locale}/dashboard`);

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <header className="border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
          >
            <ChevronLeft className="h-4 w-4" />
            {tNav('backToAdmin')}
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-500/35 bg-violet-950/50 shadow-inner shadow-black/30">
              <Languages className="h-5 w-5 text-violet-300" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{t('title')}</h1>
              <p className="text-xs text-zinc-500">{t('subtitle')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/50 to-zinc-950 px-5 py-5 shadow-lg shadow-black/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/50 bg-amber-500/15">
                <Zap className="h-6 w-6 text-amber-300" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-amber-100">{t('overlordTitle')}</h2>
                <p className="mt-1 text-sm leading-relaxed text-amber-100/70">
                  {t('overlordP1')}
                  <code className="text-amber-200/90">{t('overlordCode')}</code>
                  {t('overlordP2')}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/admin/babel-guardian/wizard"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
            >
              <Zap className="h-4 w-4" />
              {t('overlordCta')}
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-violet-500/25 bg-violet-950/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-relaxed text-violet-100/90">
            <p className="font-medium text-violet-200">{t('philosophyTitle')}</p>
            <p className="mt-2 text-violet-100/80">
              {t('philosophyP1')}
              <strong className="text-violet-200">{t('philosophyStrong')}</strong>
              {t('philosophyP2')}
              <Link
                href="/dashboard/admin/babel-guardian/expansion"
                className="text-violet-300 underline-offset-2 hover:underline"
              >
                {t('expansionLink')}
              </Link>
              {t('philosophyP3')}
              <strong className="text-violet-200">{t('philosophyStrong2')}</strong>
              {t('philosophyP4')}
              <code className="rounded bg-black/30 px-1 text-xs">{t('messagesGlob')}</code>
              {t('philosophyP5')}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href="/dashboard/admin/babel-guardian/wizard"
              className="rounded-xl border border-emerald-500/45 bg-emerald-600/20 px-4 py-2.5 text-center text-sm font-medium text-emerald-100 transition hover:bg-emerald-600/30"
            >
              {t('wizardCta')}
            </Link>
            <Link
              href="/dashboard/admin/babel-guardian/expansion"
              className="rounded-xl border border-violet-500/40 bg-violet-600/20 px-4 py-2.5 text-center text-sm font-medium text-violet-100 transition hover:bg-violet-600/30"
            >
              {t('expansionCta')}
            </Link>
          </div>
        </section>

        <details className="group rounded-2xl border border-zinc-800 bg-zinc-950/40 open:border-zinc-700">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-300 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-zinc-500 group-open:rotate-90 transition" aria-hidden>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </span>
              {t('checklistSummary')}
            </span>
          </summary>
          <div className="border-t border-zinc-800/80 px-2 pb-4 pt-2">
            <BabelLanguagePlaybook variant="full" />
          </div>
        </details>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
          <p className="font-medium text-amber-200">{t('demoTitle')}</p>
          <p className="mt-2 text-amber-100/75">
            {t('demoP1')}
            <code className="text-amber-200/90">{t('demoCode1')}</code>
            {t('demoP2')}
            <code className="text-amber-200/90">{t('demoCode2')}</code>
            {t('demoP3')}
          </p>
        </section>
      </div>
    </div>
  );
}
