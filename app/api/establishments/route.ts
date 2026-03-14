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
    .select('subscription_plan, selected_plan, establishment_name, address, google_location_id, google_location_name, google_location_address')
    .eq('id', user.id)
    .single();

  const planSlug = toPlanSlug(
    profile?.subscription_plan ?? null,
    profile?.selected_plan ?? null
  );
  const basePrice = PLAN_PRICES[planSlug] ?? PLAN_PRICES.pulse;

  const { data: establishments, error } = await supabase
    .from('establishments')
    .select('id, name, address, google_location_id, google_location_name, google_connected_at, display_order, created_at')
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

  // Établissement principal en première position
  const principal = {
    id: 'profile',
    name: profile?.establishment_name?.trim() || 'Mon établissement',
    address: profile?.address?.trim() || null,
    googleStatus: (profile?.google_location_id ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
    googleLocationName: profile?.google_location_name ?? null,
    avgRating: principalAvgRating,
    priceAfterDiscount: getPriceAfterDiscount(basePrice, 0),
    discountPercent: 0,
    index: 0,
    isPrincipal: true,
  };

  const addons = (establishments ?? []).map((e, i) => {
    const idx = i + 1;
    const discount = idx === 1 ? 20 : idx === 2 ? 30 : idx === 3 ? 40 : 50;
    return {
      id: e.id,
      name: e.name || 'Sans nom',
      address: e.address ?? null,
      googleStatus: (e.google_location_id ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
      googleLocationName: e.google_location_name ?? null,
      avgRating: getAvg(e.id),
      priceAfterDiscount: getPriceAfterDiscount(basePrice, idx),
      discountPercent: discount,
      index: idx,
      isPrincipal: false,
    };
  });

  const list = [principal, ...addons];

  const totalSavings = getTotalSavings(planSlug, list.length);

  return NextResponse.json({
    establishments: list,
    planSlug,
    basePrice,
    totalSavings,
  });
  } catch (err) {
    console.error('[api/establishments GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : undefined;
  const googleLocationId = typeof body.googleLocationId === 'string' ? body.googleLocationId.trim() : undefined;
  const googleLocationName = typeof body.googleLocationName === 'string' ? body.googleLocationName.trim() : undefined;
  const googleLocationAddress = typeof body.googleLocationAddress === 'string' ? body.googleLocationAddress.trim() : undefined;

  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: 'Le nom de l\'établissement est requis (min. 2 caractères)' },
      { status: 400 }
    );
  }

  const { count } = await supabase
    .from('establishments')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id);

  const displayOrder = (count ?? 0);

  const { data: inserted, error } = await supabase
    .from('establishments')
    .insert({
      user_id: user.id,
      name,
      address: address || googleLocationAddress || null,
      google_location_id: googleLocationId || null,
      google_location_name: googleLocationName || null,
      google_location_address: googleLocationAddress || null,
      google_connected_at: googleLocationId ? new Date().toISOString() : null,
      display_order: displayOrder,
    })
    .select('id, name, address, display_order, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, establishment: inserted });
}
