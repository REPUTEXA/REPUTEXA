import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { UpdatesList } from '@/components/dashboard/updates-list';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function UpdatesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6">
        <p className="text-sm text-slate-500">Non authentifié.</p>
      </div>
    );
  }

  const { data: suggestions } = await supabase
    .from('app_suggestions')
    .select('id, title, completed_at')
    .eq('status', 'DONE')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50);

  const updates = (suggestions ?? []).map((s) => ({
    id: s.id,
    title: s.title ?? '',
    completedAt: (s.completed_at ?? new Date().toISOString()) as string,
  }));

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 max-w-[900px] mx-auto">
      <header>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100 tracking-tight">
          Mises à jour
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Les fonctionnalités livrées grâce à vos retours. L&apos;outil évolue en temps réel.
        </p>
      </header>
      <UpdatesList updates={updates} locale={locale} />
    </div>
  );
}
