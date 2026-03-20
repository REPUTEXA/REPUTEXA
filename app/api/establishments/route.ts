import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import {
  getPriceAfterDiscount,
  getTotalSavings,
  PLAN_PRICES,
} from '@/lib/establishments';

export async function GET() {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan, establishment_name, establishment_type, address, google_location_id, google_location_name, google_location_address, subscription_quantity, default_establishment_id')
    .eq('id', user.id)
    .single();

  const defaultEstablishmentId = (profile?.default_establishment_id as string | null) ?? null;

  const planSlug = toPlanSlug(
    profile?.subscription_plan ?? null,
    profile?.selected_plan ?? null
  );
  const basePrice = PLAN_PRICES[planSlug] ?? PLAN_PRICES.pulse;

  const { data: establishments, error } = await supabase
    .from('establishments')
    .select('id, name, address, google_location_id, google_location_name, google_connected_at, display_order, created_at, needs_configuration')
    .eq('user_id', user.id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Moyenne des avis : principal (establishment_id IS NULL) + par établissement
  let allReviews: { rating?: number; establishment_id?: string | null }[] = [];
  const { data: reviewsData, error: reviewsError } = await supabase
    .from('reviews')
    .select('rating, establishment_id')
    .eq('user_id', user.id);
  if (reviewsError) {
    const { data: fallback } = await supabase
      .from('reviews')
      .select('rating')
      .eq('user_id', user.id);
    allReviews = (fallback ?? []).map((r) => ({ ...r, establishment_id: null }));
  } else {
    allReviews = reviewsData ?? [];
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
    name: profile?.establishment_name?.trim() || 'Mon établissement',
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
      name: e.name || (e.needs_configuration ? 'À configurer' : 'Sans nom'),
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
  const subscriptionQuantity = Math.max(1, (profile?.subscription_quantity as number | null) ?? 1);

  return NextResponse.json({
    establishments: list,
    planSlug,
    basePrice,
    totalSavings,
    subscriptionQuantity,
  });
  } catch (err) {
    console.error('[api/establishments GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * Création d'établissement désactivée (flux Stripe-First).
 * Les nouveaux emplacements sont créés uniquement par le webhook invoice.paid après paiement.
 * Pour ajouter un emplacement : bouton "Ajouter un nouvel emplacement" → Stripe Checkout.
 */
export async function POST(_request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
        error: 'Quota atteint. Veuillez augmenter votre abonnement.',
        limitReached: true,
        subscriptionQuantity,
        billingPortalPath: '/api/stripe/portal',
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      error: 'Pour ajouter un emplacement, augmentez votre abonnement depuis le tableau de bord (paiement Stripe).',
      limitReached: false,
      subscriptionQuantity,
    },
    { status: 403 }
  );
}
