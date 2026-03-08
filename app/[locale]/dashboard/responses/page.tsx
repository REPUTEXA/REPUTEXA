import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { StarRating } from '@/components/dashboard/star-rating';
import { GenerateWithAIButton } from '@/components/dashboard/generate-with-ai-button';
import { Check } from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

export const dynamic = 'force-dynamic';

export default async function ResponsesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Dashboard.overview');

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">
          Réponses IA
        </h1>
        <p className="text-sm text-white/50 mt-0.5">
          Gérez et générez des réponses pour vos avis
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="rounded-lg bg-blue-500/90 px-3 py-1.5 text-xs font-medium text-white"
        >
          Tous
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5"
        >
          Non répondus
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5"
        >
          Négatifs
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {reviews.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-white/50">{t('reviewsEmpty')}</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                  {review.establishmentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{review.establishmentName}</p>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="inline-block rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300 mt-1">
                    Google
                  </span>
                  <p className="mt-2 text-sm text-white/80 leading-relaxed">
                    {review.reviewText}
                  </p>
                  {review.responseText ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                      <Check className="h-4 w-4" />
                      Réponse envoyée
                    </p>
                  ) : (
                    <div className="mt-2">
                      <GenerateWithAIButton
                        reviewId={review.id}
                        reviewText={review.reviewText}
                        reviewerName={review.establishmentName}
                        rating={review.rating}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
