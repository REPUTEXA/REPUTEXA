import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireFeature } from '@/lib/api-plan-guard';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import { sendOptInMessage } from '@/lib/zenith-capture/send-opt-in';

/**
 * POST /api/zenith-capture/send-opt-in
 * Envoie le message opt-in du flux Zenith Intelligence.
 * Plan Zenith requis. Appelé par cron (header X-Cron-Secret), POS, ou manuellement.
 */
export async function POST(request: Request) {
  let body: { phone?: string; userId?: string };
  try {
    body = (await request.json().catch(() => ({}))) as { phone?: string; userId?: string };
  } catch {
    return apiJsonError(request, 'errors.zenithCapture_invalidJson', 400);
  }

  const cronSecret = request.headers.get('x-cron-secret');
  const isCron = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  let effectiveUserId: string | undefined;
  if (isCron) {
    effectiveUserId = body.userId?.trim();
    if (!effectiveUserId) {
      return apiJsonError(request, 'errors.zenithCapture_cronUserIdRequired', 400);
    }
  } else {
    const planCheck = await requireFeature(FEATURES.AI_CAPTURE);
    if (planCheck instanceof NextResponse) return planCheck;
    effectiveUserId = planCheck.userId;
  }

  try {
    const phone = body.phone?.trim();
    if (!phone) {
      return apiJsonError(request, 'errors.zenithCapture_phoneRequired', 400);
    }

    const supabase = isCron ? createAdminClient() : await createClient();
    if (!supabase) {
      return apiJsonError(request, 'errors.zenithCapture_supabaseConfig', 500);
    }
    const userId = effectiveUserId!;
    if (!userId) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('establishment_name, full_name, subscription_plan, selected_plan')
      .eq('id', userId)
      .single();

    if (isCron && profile) {
      const planSlug = toPlanSlug(profile.subscription_plan ?? null, profile.selected_plan ?? null);
      if (!hasFeature(planSlug, FEATURES.AI_CAPTURE)) {
        return apiJsonError(request, 'errors.zenithCapture_planZenithRequired', 403);
      }
    }

    const authorName =
      (profile?.full_name as string | null)?.trim() ||
      (profile?.establishment_name as string | null)?.trim() ||
      undefined;

    const result = await sendOptInMessage({
      userId,
      phone,
      establishmentName: profile?.establishment_name ?? undefined,
      authorName,
    });

    if (result.reason === 'blacklist') {
      return NextResponse.json({ sent: false, reason: 'blacklist' }, { status: 200 });
    }
    if (result.reason === 'solicitation_cooldown') {
      return NextResponse.json({ sent: false, reason: 'solicitation_cooldown' }, { status: 200 });
    }
    if (!result.sent) {
      return apiJsonError(request, 'errors.zenithCapture_sendFailed', 500);
    }

    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error('[zenith-capture/send-opt-in]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
