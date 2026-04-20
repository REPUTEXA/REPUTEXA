import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StaffMissionCompleteForm } from './staff-mission-complete-form';

type Props = { params: Promise<{ locale: string }> };

export default async function StaffMissionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff.missions' });

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
      <p className="mt-3 text-slate-600 dark:text-zinc-400">{t('empty')}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">{t('completeIntro')}</p>
      <StaffMissionCompleteForm />
    </div>
  );
}
