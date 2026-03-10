import { NextResponse } from 'next/server';
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
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
  }

  const cronSecret = request.headers.get('x-cron-secret');
  const isCron = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  let effectiveUserId: string | undefined;
  if (isCron) {
    effectiveUserId = body.userId?.trim();
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'userId requis pour appel cron' }, { status: 400 });
    }
  } else {
    const planCheck = await requireFeature(FEATURES.AI_CAPTURE);
    if (planCheck instanceof NextResponse) return planCheck;
    effectiveUserId = planCheck.userId;
  }

  try {
    const phone = body.phone?.trim();
    if (!phone) {
      return NextResponse.json(
        { error: 'phone requis' },
        { status: 400 }
      );
    }

    const supabase = isCron ? createAdminClient() : await createClient();
    const userId = effectiveUserId!;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('establishment_name, full_name, subscription_plan, selected_plan')
      .eq('id', userId)
      .single();

    if (isCron && profile) {
      const planSlug = toPlanSlug(profile.subscription_plan ?? null, profile.selected_plan ?? null);
      if (!hasFeature(planSlug, FEATURES.AI_CAPTURE)) {
        return NextResponse.json({ error: 'Plan Zenith requis' }, { status: 403 });
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
    if (result.reason === 'contacted_90_days') {
      return NextResponse.json({ sent: false, reason: 'contacted_90_days' }, { status: 200 });
    }
    if (!result.sent) {
      return NextResponse.json(
        { error: result.error ?? 'Envoi échoué' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error('[zenith-capture/send-opt-in]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
