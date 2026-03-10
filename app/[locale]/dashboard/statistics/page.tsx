import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { StatisticsOverview } from '@/components/dashboard/statistics-overview';
import { FileText } from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

type ReviewDisplay = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText?: string | null;
  createdAt: string;
};

export const dynamic = 'force-dynamic';

export default async function StatisticsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  let reviews: ReviewDisplay[] = [];

  if (supabaseUser) {
    const { data: supabaseReviews } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, comment, source, response_text, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    reviews = (supabaseReviews ?? []).map((r) => {
      const safeRating =
        typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : 0;
      const created =
        typeof r.created_at === 'string' && r.created_at
          ? r.created_at
          : new Date().toISOString();
      return {
        id: String(r.id),
        reviewerName: String(r.reviewer_name ?? 'Client'),
        rating: safeRating,
        comment: String(r.comment ?? ''),
        source: String(r.source ?? 'Unknown'),
        responseText: r.response_text ?? null,
        createdAt: created,
      };
    });
  } else {
    const prismaReviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    reviews = prismaReviews.map((r) => {
      const safeRating =
        typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : 0;
      const created =
        r.createdAt instanceof Date && !Number.isNaN(r.createdAt.getTime())
          ? r.createdAt.toISOString()
          : new Date().toISOString();
      return {
        id: String(r.id),
        reviewerName: String(r.establishmentName ?? 'Client'),
        rating: safeRating,
        comment: String(r.reviewText ?? ''),
        source: 'Google',
        responseText: r.responseText ?? null,
        createdAt: created,
      };
    });
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50">
            Statistiques
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Analysez vos performances e-réputation
          </p>
        </div>
        <a
          href="/api/reports/monthly"
          className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-none dark:hover:border-slate-500 transition-all duration-300 ease-in-out"
        >
          <FileText className="w-4 h-4" />
          Télécharger le rapport PDF
        </a>
      </div>

      <StatisticsOverview reviews={reviews} locale={locale} />
    </div>
  );
}

