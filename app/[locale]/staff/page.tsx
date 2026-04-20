import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: string }> };

export default async function StaffHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff.home' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, establishment_name')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  const name =
    (profile && typeof (profile as { full_name?: string }).full_name === 'string'
      ? (profile as { full_name: string }).full_name
      : '') || t('guest');

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('greeting', { name })}</h1>
      <p className="mt-2 text-slate-600 dark:text-zinc-400">{t('hint')}</p>
    </div>
  );
}
