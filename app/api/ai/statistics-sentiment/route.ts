/**
 * Analyse de sentiment pour la page Statistiques (Pulse+).
 * Retourne forces, axes d'amélioration, insight expert.
 * Zenith : ajoute benchmark et prédictions.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { checkPlan, toPlanSlug } from '@/lib/feature-gate';
import { guardAuthenticatedLlmCall } from '@/lib/ai-llm-budget-http';
import { apiJsonError, apiMerchantAiJsonError } from '@/lib/api/api-error-response';
import { SITE_LOCALE_CODES } from '@/lib/i18n/site-locales-catalog';

export const dynamic = 'force-dynamic';

/** English labels for LLM output-language instructions (UI locale → model output). */
const LOCALE_TO_LLM_LANGUAGE: Record<(typeof SITE_LOCALE_CODES)[number], string> = {
  fr: 'French',
  en: 'English (US)',
  'en-gb': 'British English',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
};

function resolveOutputLanguage(localeParam: string | null): string {
  const code = (localeParam ?? 'fr').toLowerCase() as (typeof SITE_LOCALE_CODES)[number];
  if ((SITE_LOCALE_CODES as readonly string[]).includes(code)) {
    return LOCALE_TO_LLM_LANGUAGE[code];
  }
  return 'French';
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type SentimentPayload = {
  strengths: string[];
  improvements: string[];
  expertInsight: string;
  benchmark: string | null;
  predictions: string | null;
  notEnoughData?: boolean;
};

const SENTIMENT_CACHE = new Map<string, { createdAt: number; payload: SentimentPayload }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return apiJsonError(request, 'errors.openaiNotConfigured', 500);
    }

    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const periodParam = url.searchParams.get('period') ?? '';
    const localeParam = url.searchParams.get('locale');
    const outputLanguage = resolveOutputLanguage(localeParam);

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
    if (!checkPlan(planSlug, 'vision')) {
      return apiJsonError(request, 'errors.ai_subscriptionRequired', 403);
    }

    let fromIso: string | null = null;
    let toIso: string | null = null;
    if (fromParam && toParam) {
      const fromDate = new Date(fromParam);
      const toDate = new Date(toParam);
      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
        const start = fromDate <= toDate ? fromDate : toDate;
        const end = fromDate <= toDate ? toDate : fromDate;
        fromIso = new Date(start.setHours(0, 0, 0, 0)).toISOString();
        toIso = new Date(end.setHours(23, 59, 59, 999)).toISOString();
      }
    }

    const periodKey = fromIso && toIso ? `${fromIso}::${toIso}` : 'all';
    const cacheKey = `${user.id}:${planSlug}:${periodKey}:${periodParam}:${outputLanguage}`;
    const cached = SENTIMENT_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }

    let query = supabase
      .from('reviews')
      .select('rating, comment, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80);

    if (fromIso && toIso) {
      query = supabase
        .from('reviews')
        .select('rating, comment, created_at')
        .eq('user_id', user.id)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(80);
    }

    const { data: reviews } = await query;

    const list = (reviews ?? []).map((r) => `[${r.rating}/5] ${r.comment}`).filter(Boolean);
    const minReviews = planSlug === 'vision' ? 3 : 5;
    if (list.length < minReviews) {
      const payload: SentimentPayload = {
        strengths: [],
        improvements: [],
        expertInsight: '',
        benchmark: null,
        predictions: null,
        notEnoughData: true,
      };
      SENTIMENT_CACHE.set(cacheKey, { createdAt: Date.now(), payload });
      return NextResponse.json(payload);
    }

    const isZenith = planSlug === 'zenith';
    const isVision = planSlug === 'vision';

    const budgetBlock = await guardAuthenticatedLlmCall(user.id);
    if (budgetBlock) return budgetBlock;

    const basePromptLines = [
      'You are a senior e-reputation consultant in BUSINESS COACH mode.',
      'Analyze these reviews and return ONLY valid JSON.',
      '',
      'STRICT CONSTRAINTS:',
      '- FORBIDDEN: vague filler like "positive customer experience", "keep the quality", "stay on track", "overall positive", "good experience".',
      '- Ground your analysis in CONCRETE elements from the reviews; expected theme examples: "wait time", "staff friendliness", "cold food", "dining room cleanliness", "noise", "price", "dessert quality", etc.',
      '- strengths and improvements must be very short word groups (max 3 words) describing concrete themes (e.g. "wait time", "cold food", "room cleanliness").',
      '- No marketing paraphrase; only clear, operational axes.',
      '',
      'EXPECTED JSON SHAPE:',
      '{"strengths":["word group 1","word group 2","word group 3"],"improvements":["concrete axis 1","concrete axis 2"],"expertInsight":"One ultra-concrete coaching sentence with a measurable action (max 160 characters)."}',
      '',
      'RULES FOR "expertInsight":',
      '- Single sentence, ACTIONABLE, no fluff.',
      '- Explicitly mention at least ONE theme present in strengths or improvements.',
      '- Give a precise action + measurable goal (e.g. "Cut Saturday-evening wait times to raise your average rating by 0.5 stars.").',
      '',
      `OUTPUT LANGUAGE: ${outputLanguage}. Write every JSON string value (strengths, improvements, expertInsight) entirely in this language — professional, direct tone.`,
      '',
      'Reviews to analyze:',
      list.slice(0, 50).join('\n'),
    ];

    if (isVision) {
      basePromptLines.splice(
        4,
        0,
        'VISION PLAN CONTEXT: keep 2–3 strengths and 2 short improvement axes; expertInsight = one factual sentence + one simple action (no consultant jargon).'
      );
    }

    const prompt = basePromptLines.join('\n');

    let payload: SentimentPayload;

    if (isZenith) {
      const promptZenith = [
        prompt,
        '',
        'For a ZENITH-plan merchant, extend the JSON with:',
        '- "benchmark": one sentence comparing the situation to the restaurant/hospitality sector average, factually.',
        '- "predictions": one sentence on the trend for the next 3 months if nothing changes (or possible gains if improvement axes are addressed).',
        `Write "benchmark" and "predictions" in ${outputLanguage} as well.`,
        'Final format: {"strengths":[],"improvements":[],"expertInsight":"","benchmark":"...","predictions":"..."}',
      ].join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a strategic e-reputation consultant. Reply with ONLY strictly valid JSON, no surrounding text.',
          },
          { role: 'user', content: promptZenith },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      const parsed = JSON.parse(content) as {
        strengths?: string[];
        improvements?: string[];
        expertInsight?: string;
        benchmark?: string;
        predictions?: string;
      };

      payload = {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 4) : [],
        expertInsight: String(parsed.expertInsight ?? '').trim(),
        benchmark: String(parsed.benchmark ?? '').trim() || null,
        predictions: String(parsed.predictions ?? '').trim() || null,
      };
    } else {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are an e-reputation consultant. Reply with ONLY valid JSON, no preamble or explanation.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      const parsed = JSON.parse(content) as {
        strengths?: string[];
        improvements?: string[];
        expertInsight?: string;
      };

      const capStrengths = isVision ? 3 : 5;
      const capImprove = isVision ? 3 : 4;

      payload = {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, capStrengths) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, capImprove) : [],
        expertInsight: String(parsed.expertInsight ?? '').trim(),
        benchmark: null,
        predictions: null,
      };
    }

    SENTIMENT_CACHE.set(cacheKey, { createdAt: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[statistics-sentiment]', error);
    return apiMerchantAiJsonError(request, 'sentimentAnalysisFailed', 500);
  }
}
