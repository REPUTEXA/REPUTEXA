import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { ProspectsList } from '@/components/dashboard/prospects-list';

type Props = {
  params: Promise<{ locale: string }>;
};

export const dynamic = 'force-dynamic';

export default async function ProspectsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Dashboard.prospects');

  const prospects = await prisma.prospect.findMany({
    orderBy: { createdAt: 'desc' },
    where: { status: 'TO_CONTACT' },
  });

  const subtitleKey = prospects.length <= 1 ? 'subtitle' : 'subtitle_plural';

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t(subtitleKey, { count: prospects.length })}
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <ProspectsList
          prospects={prospects.map((p) => ({
            id: p.id,
            establishmentName: p.establishmentName,
            city: p.city,
            category: p.category,
            rating: p.rating,
            pitch: p.pitch,
            status: p.status,
          }))}
        />
      </div>
    </div>
  );
}
