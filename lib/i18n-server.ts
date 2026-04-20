/**
 * Server-side i18n for API routes (e.g. PDF generation).
 * Loads messages by locale with English fallback.
 */

const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'] as const;
type Locale = (typeof LOCALES)[number];

const cachedMessages: Record<string, Record<string, unknown>> = {};

async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  const loc = LOCALES.includes(locale as Locale) ? locale : 'en';
  if (cachedMessages[loc]) return cachedMessages[loc] as Record<string, unknown>;
  try {
    const mod = await import(`@/messages/${loc}.json`);
    cachedMessages[loc] = mod.default;
    return mod.default;
  } catch {
    const mod = await import('@/messages/en.json');
    cachedMessages.en = mod.default;
    return mod.default;
  }
}

export type ReportTranslations = {
  title: string;
  period: string;
  overview: string;
  avgRating: string;
  totalReviews: string;
  positiveReviews: string;
  negativeReviews: string;
  performance: string;
  performanceSubtitle: string;
  platformVolume: string;
  noData: string;
  reviewsCount: string;
  roadmapTitle: string;
  roadmapSubtitle: string;
  insufficientData: string;
  problemDetected: string;
  solutionReputexa: string;
  expectedImpact: string;
  myEstablishment: string;
};

export async function getReportTranslations(locale: string): Promise<ReportTranslations> {
  const messages = await loadMessages(locale);
  const R = (messages.Report as Record<string, string>) ?? {};
  const fallback = await loadMessages('en');
  const RF = (fallback.Report as Record<string, string>) ?? {};
  return {
    title: R.title ?? RF.title ?? 'REPUTEXA — Monthly report',
    period: R.period ?? RF.period ?? 'Period',
    overview: R.overview ?? RF.overview ?? 'Overview',
    avgRating: R.avgRating ?? RF.avgRating ?? 'Average rating',
    totalReviews: R.totalReviews ?? RF.totalReviews ?? 'Total reviews',
    positiveReviews: R.positiveReviews ?? RF.positiveReviews ?? 'Positive reviews (4★–5★)',
    negativeReviews: R.negativeReviews ?? RF.negativeReviews ?? 'Negative reviews (1★–3★)',
    performance: R.performance ?? RF.performance ?? 'Performance',
    performanceSubtitle:
      R.performanceSubtitle ??
      RF.performanceSubtitle ??
      'Summary view by platform',
    platformVolume: R.platformVolume ?? RF.platformVolume ?? 'Review volume by platform',
    noData: R.noData ?? RF.noData ?? 'Insufficient data for this month.',
    reviewsCount: R.reviewsCount ?? RF.reviewsCount ?? '{count} reviews',
    roadmapTitle: R.roadmapTitle ?? RF.roadmapTitle ?? 'AI strategic roadmap',
    roadmapSubtitle: R.roadmapSubtitle ?? RF.roadmapSubtitle ?? 'Recurring trends and recommendations',
    insufficientData: R.insufficientData ?? RF.insufficientData ?? 'Insufficient data for recommendations.',
    problemDetected: R.problemDetected ?? RF.problemDetected ?? 'Problem detected',
    solutionReputexa: R.solutionReputexa ?? RF.solutionReputexa ?? 'REPUTEXA solution',
    expectedImpact: R.expectedImpact ?? RF.expectedImpact ?? 'Expected impact',
    myEstablishment: R.myEstablishment ?? RF.myEstablishment ?? 'My establishment',
  };
}
