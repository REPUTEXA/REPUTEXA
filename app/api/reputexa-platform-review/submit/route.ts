import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';

type Body = {
  bodyOriginal?: string;
  bodyOptimized?: string;
  bodyPublic?: string;
  rating?: number;
  displayName?: string;
  roleLine?: string;
  countryLabel?: string;
  flagEmoji?: string;
  locale?: string;
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

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'supabaseAdminNotConfigured', 500);
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const bodyOriginal = String(body.bodyOriginal ?? '').trim();
    const bodyOptimized = String(body.bodyOptimized ?? '').trim();
    const bodyPublic = String(
      body.bodyPublic ?? (bodyOptimized || bodyOriginal) ?? '',
    ).trim();
    const displayName = String(body.displayName ?? '').trim();
    const roleLine = String(body.roleLine ?? '').trim();
    const countryLabel = String(body.countryLabel ?? '').trim();
    const flagEmoji = String(body.flagEmoji ?? '').trim();
    const locale = String(body.locale ?? 'fr').trim().slice(0, 12) || 'fr';
    const rawRating = typeof body.rating === 'number' ? body.rating : Number(body.rating);
    const rating =
      Number.isFinite(rawRating) && rawRating >= 1 && rawRating <= 5 ? Math.round(rawRating) : 5;

    if (!bodyOriginal || bodyOriginal.length < 8) {
      return apiJsonError(request, 'reputexaPlatformReview_bodyTooShort', 400);
    }
    if (!bodyPublic || bodyPublic.length < 8) {
      return apiJsonError(request, 'reputexaPlatformReview_bodyTooShort', 400);
    }
    if (!displayName || displayName.length < 2) {
      return apiJsonError(request, 'reputexaPlatformReview_displayNameRequired', 400);
    }

    const row = {
      user_id: user.id,
      locale,
      rating,
      body_original: bodyOriginal.slice(0, 12000),
      body_optimized: bodyOptimized ? bodyOptimized.slice(0, 12000) : null,
      body_public: bodyPublic.slice(0, 12000),
      display_name: displayName.slice(0, 200),
      role_line: roleLine ? roleLine.slice(0, 300) : null,
      country_label: countryLabel ? countryLabel.slice(0, 120) : null,
      flag_emoji: flagEmoji ? flagEmoji.slice(0, 16) : null,
      status: 'pending' as const,
    };

    const { error: upsertError } = await admin.from('reputexa_platform_reviews').upsert(row, {
      onConflict: 'user_id',
    });

    if (upsertError) {
      console.error('[reputexa-platform-review/submit] upsert', upsertError);
      return apiJsonError(request, 'reputexaPlatformReview_submitFailed', 500);
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ reputexa_platform_review_submitted_at: new Date().toISOString() })
      .eq('id', user.id);

    if (profileError) {
      console.error('[reputexa-platform-review/submit] profile', profileError);
      return apiJsonError(request, 'reputexaPlatformReview_submitFailed', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/reputexa-platform-review/submit]', e);
    return apiJsonError(request, 'reputexaPlatformReview_submitFailed', 500);
  }
}
