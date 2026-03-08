import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function StatisticsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">
          Statistiques
        </h1>
        <p className="text-sm text-white/50 mt-0.5">
          Analysez vos performances e-réputation
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-white/50">Graphiques et statistiques détaillées à venir.</p>
          <p className="text-sm text-white/30 mt-2">Bientôt disponible</p>
        </div>
      </div>
    </div>
  );
}
