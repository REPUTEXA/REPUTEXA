import { setRequestLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { StatisticsOverview } from '@/components/dashboard/statistics-overview';
import { ArchivesInsightsSection } from '@/components/dashboard/archives-insights-section';
import { WeeklyInsightSection } from '@/components/dashboard/weekly-insight-section';
import { toPlanSlug } from '@/lib/feature-gate';

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
  const t = await getTranslations('Statistics');

  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  let reviews: ReviewDisplay[] = [];
  let planSlug: 'vision' | 'pulse' | 'zenith' = 'vision';

  if (supabaseUser) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan')
      .eq('id', supabaseUser.id)
      .single();
    planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);

    const activeLocationId = (await cookies()).get('reputexa_active_location')?.value ?? null;
    let reviewsQuery = supabase
      .from('reviews')
      .select('id, reviewer_name, rating, comment, source, response_text, created_at')
      .eq('user_id', supabaseUser.id);
    if (activeLocationId === 'profile') {
      reviewsQuery = reviewsQuery.is('establishment_id', null);
    } else if (activeLocationId && /^[0-9a-f-]{36}$/i.test(activeLocationId)) {
      reviewsQuery = reviewsQuery.eq('establishment_id', activeLocationId);
    }
    const { data: supabaseReviews } = await reviewsQuery
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
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 max-w-[1600px] mx-auto relative z-10">
      <header>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('description')}
        </p>
      </header>

      <StatisticsOverview reviews={reviews} locale={locale} planSlug={planSlug} />

      <WeeklyInsightSection planSlug={planSlug} />

      <ArchivesInsightsSection planSlug={planSlug} locale={locale} />
    </div>
  );
}

