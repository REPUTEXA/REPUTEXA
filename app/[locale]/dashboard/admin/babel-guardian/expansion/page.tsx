import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { BabelExpansionClient } from '@/components/admin/babel-expansion-client';
import { BabelLanguagePlaybook } from '@/components/admin/babel-language-playbook';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export default async function BabelExpansionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.adminBabelExpansion' });

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
            href="/dashboard/admin/babel-guardian"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('backLink')}
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-500/35 bg-violet-950/50 shadow-inner shadow-black/30">
              <Sparkles className="h-5 w-5 text-violet-300" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{t('title')}</h1>
              <p className="text-xs text-zinc-500">{t('subtitle')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <BabelLanguagePlaybook variant="compact" />
      </div>

      <BabelExpansionClient />
    </div>
  );
}
