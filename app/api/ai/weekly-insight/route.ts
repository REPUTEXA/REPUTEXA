import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';
import { apiJsonError } from '@/lib/api/api-error-response';
import { guardAuthenticatedLlmCall } from '@/lib/ai-llm-budget-http';
import { startOfWeek, subWeeks, format } from 'date-fns';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type WeeklyInsightPayload = {
  topSection: string;
  watchSection: string;
  adviceSection: string;
  fullReport: string;
  trendSeverity: number;
};

function getLastWeekBounds(): { from: Date; to: Date } {
  const now = new Date();
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
  lastWeekEnd.setHours(23, 59, 59, 999);
  return { from: lastWeekStart, to: lastWeekEnd };
}

function emptyWeekPayload(
  tAi: ReturnType<typeof createServerTranslator>,
  establishmentName: string,
  weekLabel: string
): WeeklyInsightPayload {
  return {
    topSection: tAi('weeklyInsightNoReviewsTop'),
    watchSection: tAi('weeklyInsightNoReviewsWatch'),
    adviceSection: tAi('weeklyInsightNoReviewsAdvice'),
    fullReport: tAi('weeklyInsightNoReviewsFullReport', { weekLabel, establishmentName }),
    trendSeverity: 0,
  };
}

async function generateWeeklyInsight(
  reviews: { rating: number; comment: string; source: string; created_at: string }[],
  establishmentName: string,
  weekLabel: string,
  tAi: ReturnType<typeof createServerTranslator>
): Promise<WeeklyInsightPayload> {
  if (reviews.length === 0) {
    return emptyWeekPayload(tAi, establishmentName, weekLabel);
  }

  const joined = reviews
    .map((r) => `[${r.rating}/5] (${r.source}) ${r.comment}`)
    .join('\n---\n')
    .slice(0, 12000);

  const promptParts = [
    tAi('weeklyInsightPromptRules'),
    ...(reviews.length < 3 ? [tAi('weeklyInsightScarceReviewsNote', { count: reviews.length })] : []),
    tAi('weeklyInsightPromptJsonSpec'),
    '',
    tAi('weeklyInsightPromptEstablishmentLine', { establishmentName }),
    tAi('weeklyInsightPromptWeekLine', { weekLabel }),
    '',
    tAi('weeklyInsightPromptReviewsIntro'),
    '"""',
    joined,
    '"""',
  ];
  const prompt = `${promptParts.join('\n')}\n\n${tAi('weeklyInsightModelLanguageHint')}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: tAi('weeklyInsightSystemPrompt'),
      },
      { role: 'user', content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    topSection: String(parsed.topSection ?? ''),
    watchSection: String(parsed.watchSection ?? ''),
    adviceSection: String(parsed.adviceSection ?? ''),
    fullReport: String(parsed.fullReport ?? ''),
    trendSeverity: Math.min(100, Math.max(0, Number(parsed.trendSeverity) || 0)),
  };
}

/**
 * GET : génère et retourne l'insight hebdomadaire pour l'utilisateur connecté (Pulse/Zenith).
 */
export async function GET(request: Request) {
  const locale = apiLocaleFromRequest(request);
  const tAi = createServerTranslator('ApiAi', locale);
  const dfLocale = dateFnsLocaleForApp(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiJsonError(request, 'unauthorized', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan, establishment_name')
    .eq('id', user.id)
    .single();

  const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
  if (!hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP)) {
    return apiJsonError(request, 'errors.ai_pulseZenithWeeklyInsight', 403);
  }

  const { from, to } = getLastWeekBounds();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, source, created_at')
    .eq('user_id', user.id)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false });

  const list = reviews ?? [];

  const avgRating =
    list.length === 0
      ? 0
      : list.reduce((s, r) => s + (typeof r.rating === 'number' ? r.rating : 0), 0) / list.length;
  const establishmentName = String(profile?.establishment_name ?? '').trim() || tAi('establishmentShortName');
  const weekLabel = `${format(from, 'd MMM', { locale: dfLocale })} - ${format(to, 'd MMM yyyy', { locale: dfLocale })}`;

  let payload: WeeklyInsightPayload;
  try {
    if (list.length > 0) {
      const budgetBlock = await guardAuthenticatedLlmCall(user.id);
      if (budgetBlock) return budgetBlock;
    }
    payload = await generateWeeklyInsight(list, establishmentName, weekLabel, tAi);
  } catch (e) {
    console.error('[ai/weekly-insight]', e);
    return apiJsonError(request, 'errors.ai_weeklyInsightFailed', 500);
  }

  const { data: inserted } = await supabase
    .from('weekly_insights')
    .upsert(
      {
        user_id: user.id,
        week_start: format(from, 'yyyy-MM-dd'),
        establishment_name: establishmentName,
        avg_rating: Math.round(avgRating * 100) / 100,
        total_reviews: list.length,
        top_section: payload.topSection,
        watch_section: payload.watchSection,
        advice_section: payload.adviceSection,
        full_report_json: {
          fullReport: payload.fullReport,
          weekLabel,
        },
        trend_severity: payload.trendSeverity,
      },
      { onConflict: 'user_id,week_start' }
    )
    .select('id')
    .single();

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    weekLabel,
    totalReviews: list.length,
    avgRating: Math.round(avgRating * 100) / 100,
    topSection: payload.topSection,
    watchSection: payload.watchSection,
    adviceSection: payload.adviceSection,
    fullReport: payload.fullReport,
    trendSeverity: payload.trendSeverity,
  });
}
