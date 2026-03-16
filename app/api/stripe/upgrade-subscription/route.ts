/**
 * Choix du futur plan pendant l'essai ZÉNITH : flag en base uniquement (plus de Subscription Schedules).
 * Met à jour profiles.selected_plan (pulse, vision ou zenith) et envoie l'email de confirmation.
 * Au passage trialing → active, le webhook appliquera le bon prix Stripe selon selected_plan.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_BASE_PRICES_EUR, type PlanSlug } from '@/config/pricing';
import {
  sendPlanSelectionConfirmationEmail,
  PLAN_DISPLAY,
} from '@/lib/services/billing-domain';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim().toLowerCase() : '';

    if (planSlug !== 'pulse' && planSlug !== 'vision' && planSlug !== 'zenith') {
      return NextResponse.json({ error: 'Plan invalide (attendu: pulse, vision ou zenith)' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    let profileLocale = 'fr';
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, language, trial_ends_at')
      .eq('email', user.email)
      .limit(1);

    if (!profiles?.length) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    const profile = profiles[0];
    profileLocale = (profile.language as string) ?? 'fr';

    // Si l'utilisateur clique sur "Rester sur ZÉNITH", on considère que
    // aucun plan futur spécifique n'est choisi : on remet selected_plan à null
    // (le webhook utilisera alors le plan ZENITH par défaut) et on ne
    // déclenche PAS l'email de confirmation de changement de plan.
    if (planSlug === 'zenith') {
      await admin
        .from('profiles')
        .update({ selected_plan: null })
        .eq('id', profile.id);
      return NextResponse.json({ ok: true });
    }

    await admin
      .from('profiles')
      .update({ selected_plan: planSlug })
      .eq('id', profile.id);

    const planName = PLAN_DISPLAY[planSlug as PlanSlug] ?? planSlug;
    const trialEndDateFormatted = profile.trial_ends_at
      ? new Date(profile.trial_ends_at as string).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
    const basePriceEur = PLAN_BASE_PRICES_EUR[planSlug as PlanSlug] ?? 0;
    const planPrice = `${basePriceEur} €/mois`;

    sendPlanSelectionConfirmationEmail({
      to: user.email,
      planName,
      planPrice,
      trialEndDate: trialEndDateFormatted,
      locale: profileLocale,
    }).catch((err) => console.error('[stripe/upgrade-subscription] sendPlanSelectionConfirmationEmail', err));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[stripe/upgrade-subscription]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour',
      },
      { status: 500 }
    );
  }
}
