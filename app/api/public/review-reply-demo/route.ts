import { NextRequest, NextResponse } from 'next/server';
import { checkReviewReplyDemoRateLimit } from '@/lib/rate-limit';
import {
  buildFallbackDemoGeneration,
  generateDemoDashboardReplies,
  type DemoReplyGeneration,
} from '@/lib/landing/demo-dashboard-replies';
import {
  getDemoExampleFromPreset,
  parseDemoRandomSeed,
  parseDemoReviewPreset,
  type DemoDashboardExample,
  type DemoReviewPresetParam,
} from '@/lib/landing/demo-dashboard-data';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const GENERATION_BUDGET_MS = 28_000;

function withBudget<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('review-reply-demo-timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function demoLocale(raw: string | null | undefined): string {
  if (raw === 'fr') return 'fr';
  return 'en';
}

function apiKeysConfigured(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

function payload(
  ex: DemoDashboardExample,
  gen: DemoReplyGeneration,
  source: 'live' | 'static' | 'rate_limited' | 'error',
  meta: { reviewPreset: DemoReviewPresetParam; resolvedReviewTone: DemoDashboardExample['reviewTone'] }
) {
  return {
    ok: true as const,
    source,
    reviewPreset: meta.reviewPreset,
    resolvedReviewTone: meta.resolvedReviewTone,
    business: ex.business,
    reviewer: ex.reviewer,
    review: ex.review,
    rating: ex.rating,
    sector: ex.sector,
    phone: ex.phone,
    email: ex.email,
    options: gen.options,
    selectedIndex: gen.selectedIndex,
    judgeEngine: gen.judgeEngine,
    enginesUsed: gen.enginesUsed,
    primaryEngine: gen.primaryEngine,
    revisedShorter: gen.revisedShorter,
  };
}

export async function POST(request: NextRequest) {
  let body: {
    locale?: string;
    reviewPreset?: string;
    randomSeed?: number;
    exampleIndex?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const locale = demoLocale(body.locale);
  const reviewPreset = parseDemoReviewPreset(
    typeof body.reviewPreset === 'string' ? body.reviewPreset : undefined
  );
  const randomSeed =
    parseDemoRandomSeed(body.randomSeed) ?? Math.floor(Math.random() * 1e9);
  const { example: ex, resolvedTone: resolvedReviewTone } = getDemoExampleFromPreset(
    locale,
    reviewPreset,
    randomSeed
  );

  const limited = checkReviewReplyDemoRateLimit(request);
  const meta = { reviewPreset, resolvedReviewTone };
  if (!limited.ok) {
    const gen = buildFallbackDemoGeneration(locale, ex);
    return NextResponse.json(payload(ex, gen, 'rate_limited', meta), {
      headers: NO_STORE,
    });
  }

  if (!apiKeysConfigured()) {
    const gen = buildFallbackDemoGeneration(locale, ex);
    return NextResponse.json(payload(ex, gen, 'static', meta), {
      headers: NO_STORE,
    });
  }

  try {
    const gen = await withBudget(
      generateDemoDashboardReplies(locale, ex),
      GENERATION_BUDGET_MS
    );
    return NextResponse.json(payload(ex, gen, 'live', meta), {
      headers: NO_STORE,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg !== 'review-reply-demo-timeout') {
      console.error('[review-reply-demo]', e);
    }
    const gen = buildFallbackDemoGeneration(locale, ex);
    return NextResponse.json(payload(ex, gen, 'error', meta), {
      headers: NO_STORE,
    });
  }
}
