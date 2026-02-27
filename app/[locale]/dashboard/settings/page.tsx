import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Dashboard.settings');

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t('description')}</p>
      </header>
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-zinc-500">{t('comingSoon')}</p>
      </div>
    </div>
  );
}
