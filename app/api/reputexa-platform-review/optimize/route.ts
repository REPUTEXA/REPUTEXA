import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { optimizeReputexaPlatformTestimonial } from '@/lib/ai/reputexa-platform-testimonial-optimize';
import { apiJsonError } from '@/lib/api/api-error-response';

type Body = {
  draft?: string;
  uiLocale?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const draft = String(body.draft ?? '').trim();
    if (!draft || draft.length < 8) {
      return apiJsonError(request, 'reputexaPlatformReview_bodyTooShort', 400);
    }
    if (draft.length > 8000) {
      return apiJsonError(request, 'reputexaPlatformReview_bodyTooLong', 400);
    }

    const uiLocale = String(body.uiLocale ?? 'fr').trim();
    const optimized = await optimizeReputexaPlatformTestimonial({ draft, uiLocale });
    if (!optimized.trim()) {
      return apiJsonError(request, 'reputexaPlatformReview_optimizeFailed', 500);
    }

    return NextResponse.json({ optimized: optimized.trim() });
  } catch (e) {
    console.error('[api/reputexa-platform-review/optimize]', e);
    return apiJsonError(request, 'reputexaPlatformReview_optimizeFailed', 500);
  }
}
