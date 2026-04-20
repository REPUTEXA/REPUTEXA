/**
 * Choix du futur plan pendant l'essai ZÉNITH : flag en base uniquement (plus de Subscription Schedules).
 * Met à jour profiles.selected_plan (pulse, vision ou zenith) et envoie l'email de confirmation.
 * Au passage trialing → active, le webhook appliquera le bon prix Stripe selon selected_plan.
 */

import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPlanBasePricesForBillingCurrency,
  localeToBillingCurrency,
  type PlanSlug,
} from '@/config/pricing';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { sendPlanSelectionConfirmationEmail } from '@/lib/services/billing-domain';
import { PLAN_DISPLAY } from '@/lib/feature-gate';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim().toLowerCase() : '';

    if (planSlug !== 'pulse' && planSlug !== 'vision' && planSlug !== 'zenith') {
      return apiBillingJsonError(request, 'upgradePlanInvalid', 400);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    let profileLocale = 'fr';
    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serviceUnavailable', 500);
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, language, trial_ends_at')
      .eq('email', user.email)
      .limit(1);

    if (!profiles?.length) {
      return apiJsonError(request, 'errors.profileNotFoundShort', 404);
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
    const loc = normalizeAppLocale(profileLocale);
    const intlTag = siteLocaleToIntlDateTag(loc);
    const trialEndDateFormatted = profile.trial_ends_at
      ? new Date(profile.trial_ends_at as string).toLocaleDateString(intlTag, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
    const billing = localeToBillingCurrency(loc);
    const bases = getPlanBasePricesForBillingCurrency(billing);
    const baseAmount = bases[planSlug as PlanSlug] ?? 0;
    const currencyCode =
      billing === 'usd'
        ? 'USD'
        : billing === 'gbp'
          ? 'GBP'
          : billing === 'jpy'
            ? 'JPY'
            : billing === 'cny'
              ? 'CNY'
              : billing === 'chf'
                ? 'CHF'
                : 'EUR';
    const monthSuffix =
      loc === 'fr' ? ' /mois' : loc === 'zh' || loc === 'ja' ? ' /月' : ' /month';
    const planPrice =
      new Intl.NumberFormat(intlTag, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0,
      }).format(baseAmount) + monthSuffix;

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
    return apiBillingJsonError(request, 'upgradeUpdateFailed', 500);
  }
}
