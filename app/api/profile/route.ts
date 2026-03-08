import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('establishment_name, full_name, address, phone, website, whatsapp_phone, alert_threshold_stars, seo_keywords, subscription_plan, selected_plan, google_location_id, google_location_name, google_location_address')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
  return NextResponse.json({
    establishmentName: profile?.establishment_name ?? '',
    fullName: profile?.full_name ?? '',
    address: profile?.address ?? '',
    phone: profile?.phone ?? '',
    website: profile?.website ?? '',
    whatsappPhone: profile?.whatsapp_phone ?? '',
    alertThresholdStars: profile?.alert_threshold_stars ?? 3,
    seoKeywords: Array.isArray(profile?.seo_keywords) ? profile.seo_keywords.filter((k): k is string => typeof k === 'string') : [],
    selectedPlan: planSlug,
    email: user.email ?? '',
    googleLocationId: profile?.google_location_id ?? null,
    googleLocationName: profile?.google_location_name ?? null,
    googleLocationAddress: profile?.google_location_address ?? null,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { establishmentName, fullName, address, phone, website, whatsappPhone, alertThresholdStars, seoKeywords } = body;

  const updates: Record<string, string | number | string[]> = {};
  if (typeof establishmentName === 'string') updates.establishment_name = establishmentName.trim();
  if (typeof fullName === 'string') updates.full_name = fullName.trim();
  if (typeof address === 'string') updates.address = address.trim();
  if (typeof phone === 'string') updates.phone = phone.trim();
  if (typeof website === 'string') updates.website = website.trim();
  if (typeof whatsappPhone === 'string') updates.whatsapp_phone = whatsappPhone.trim();
  if (typeof alertThresholdStars === 'number' && alertThresholdStars >= 1 && alertThresholdStars <= 5) {
    updates.alert_threshold_stars = alertThresholdStars;
  }
  if (Array.isArray(seoKeywords)) {
    updates.seo_keywords = seoKeywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim());
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
