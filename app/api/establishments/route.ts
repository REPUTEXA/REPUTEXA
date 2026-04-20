import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import {
  getPriceAfterDiscount,
  getTotalSavings,
  PLAN_PRICES,
} from '@/lib/establishments';

export async function GET(request: Request) {
  const perfStart = process.env.NODE_ENV === 'development' ? performance.now() : 0;
  const locale = apiLocaleFromRequest(request);
  const te = createServerTranslator('ApiEstablishments', locale);
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiJsonError(request, 'unauthorized', 401);

  const profileSelect =
    'subscription_plan, selected_plan, establishment_name, establishment_type, address, google_location_id, google_location_name, google_location_address, subscription_quantity, default_establishment_id';

  /** Profil + lignes établissements + avis en parallèle (évite 2 allers-retours séquentiels + la relecture du quota). */
  const [profileRes, establishmentsRes, reviewsRes] = await Promise.all([
    supabase.from('profiles').select(profileSelect).eq('id', user.id).single(),
    supabase
      .from('establishments')
      .select('id, name, address, google_location_id, google_location_name, google_connected_at, display_order, created_at, needs_configuration')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('reviews').select('rating, establishment_id').eq('user_id', user.id),
  ]);

  const profile = profileRes.data;
  let { data: establishments, error } = establishmentsRes;

  if (error) {
    return apiJsonError(request, 'serverError', 500);
  }

  const defaultEstablishmentId = (profile?.default_establishment_id as string | null) ?? null;

  const planSlug = toPlanSlug(
    profile?.subscription_plan ?? null,
    profile?.selected_plan ?? null
  );
  const basePrice = PLAN_PRICES[planSlug] ?? PLAN_PRICES.pulse;
  const subscriptionQuantity = Math.max(1, (profile?.subscription_quantity as number | null) ?? 1);
  const effectiveQuantity = subscriptionQuantity;

  /** Quota payé > lignes addon : webhook ou timing — crée les slots pour débloquer la config immédiate */
  const addonCount = establishments?.length ?? 0;
  const missingAddonSlots = effectiveQuantity - 1 - addonCount;
  if (missingAddonSlots > 0 && establishments) {
    const maxOrder = establishments.reduce(
      (m, e) => Math.max(m, (e.display_order as number | undefined) ?? 0),
      -1
    );
    for (let i = 0; i < missingAddonSlots; i++) {
      const { error: insErr } = await supabase.from('establishments').insert({
        user_id: user.id,
        name: '',
        display_order: maxOrder + 1 + i,
        needs_configuration: true,
      });
      if (insErr) {
        console.error('[api/establishments GET] heal addon slots:', insErr.message);
        break;
      }
    }
    const refetch = await supabase
      .from('establishments')
      .select('id, name, address, google_location_id, google_location_name, google_connected_at, display_order, created_at, needs_configuration')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (!refetch.error && refetch.data) {
      establishments = refetch.data;
    }
  }

  // Moyenne des avis : principal (establishment_id IS NULL) + par établissement
  let allReviews: { rating?: number; establishment_id?: string | null }[] = [];
  if (reviewsRes.error) {
    const { data: fallback } = await supabase
      .from('reviews')
      .select('rating')
      .eq('user_id', user.id);
    allReviews = (fallback ?? []).map((r) => ({ ...r, establishment_id: null }));
  } else {
    allReviews = reviewsRes.data ?? [];
  }

  const avgByEstablishment: Record<string, number> = {};
  for (const r of allReviews) {
    if (typeof r.rating !== 'number' || !Number.isFinite(r.rating)) continue;
    const key = r.establishment_id ?? 'profile';
    if (!avgByEstablishment[key]) avgByEstablishment[key] = 0;
    avgByEstablishment[key] += r.rating;
  }
  const countByEstablishment: Record<string, number> = {};
  for (const r of allReviews) {
    const key = r.establishment_id ?? 'profile';
    countByEstablishment[key] = (countByEstablishment[key] ?? 0) + 1;
  }
  const getAvg = (key: string): number | null => {
    const n = countByEstablishment[key] ?? 0;
    if (n === 0) return null;
    const sum = avgByEstablishment[key] ?? 0;
    return Math.round((sum / n) * 10) / 10;
  };

  const principalAvgRating = getAvg('profile');

  const profileIsDefault = defaultEstablishmentId == null;

  const principal = {
    id: 'profile',
    name: profile?.establishment_name?.trim() || te('defaultPrincipalName'),
    establishmentType: profile?.establishment_type?.trim() || null,
    address: profile?.address?.trim() || null,
    googleStatus: (profile?.google_location_id ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
    googleLocationName: profile?.google_location_name ?? null,
    avgRating: principalAvgRating,
    priceAfterDiscount: getPriceAfterDiscount(basePrice, 0),
    discountPercent: 0,
    index: 0,
    isPrincipal: profileIsDefault,
  };

  const addons = (establishments ?? []).map((e, i) => {
    const idx = i + 1;
    const discount = idx === 1 ? 20 : idx === 2 ? 30 : idx === 3 ? 40 : 50;
    return {
      id: e.id,
      name: e.name || (e.needs_configuration ? te('slotNeedsConfiguration') : te('slotUnnamed')),
      address: e.address ?? null,
      googleStatus: (e.google_location_id ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
      googleLocationName: e.google_location_name ?? null,
      avgRating: getAvg(e.id),
      priceAfterDiscount: getPriceAfterDiscount(basePrice, idx),
      discountPercent: discount,
      index: idx,
      isPrincipal: e.id === defaultEstablishmentId,
      needsConfiguration: Boolean((e as { needs_configuration?: boolean }).needs_configuration),
    };
  });

  // Ordre : établissement par défaut en premier (profil ou addon)
  const defaultAddon = addons.find((a) => a.id === defaultEstablishmentId);
  const others = addons.filter((a) => a.id !== defaultEstablishmentId);
  const list = profileIsDefault
    ? [principal, ...addons]
    : defaultAddon
      ? [defaultAddon, principal, ...others]
      : [principal, ...addons];

  const totalSavings = getTotalSavings(planSlug, list.length);

  if (process.env.NODE_ENV === 'development' && perfStart) {
    const ms = Math.round(performance.now() - perfStart);
    if (ms > 500) {
      console.warn(`[api/establishments GET] ${ms}ms (seuil 500ms dépassé — vérifier latence Supabase ou taille table reviews)`);
    }
  }

  return NextResponse.json({
    establishments: list,
    planSlug,
    basePrice,
    totalSavings,
    subscriptionQuantity: effectiveQuantity,
  });
  } catch (err) {
    console.error('[api/establishments GET]', err);
    return apiJsonError(request, 'serverError', 500);
  }
}

/**
 * Création d'établissement désactivée (flux Stripe-First).
 * Les nouveaux emplacements sont créés uniquement par le webhook invoice.paid après paiement.
 * Pour ajouter un emplacement : bouton "Ajouter un nouvel emplacement" → Stripe Checkout.
 */
export async function POST(request: Request) {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiJsonError(request, 'unauthorized', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_quantity')
    .eq('id', user.id)
    .single();
  const subscriptionQuantity = Math.max(1, (profile?.subscription_quantity as number | null) ?? 1);

  const { count } = await supabase
    .from('establishments')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id);

  const establishmentCount = count ?? 0;
  const totalSlots = 1 + establishmentCount;

  if (totalSlots >= subscriptionQuantity) {
    return NextResponse.json(
      {
        error: t('errors.establishment_quotaReached'),
        limitReached: true,
        subscriptionQuantity,
        billingPortalPath: '/api/stripe/portal',
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      error: t('errors.establishment_addViaStripeOnly'),
      limitReached: false,
      subscriptionQuantity,
    },
    { status: 403 }
  );
}
