import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { routing } from '@/i18n/routing';

const VALID_LOCALES = routing.locales as readonly string[];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('establishment_name, establishment_type, full_name, address, phone, website, whatsapp_phone, alert_threshold_stars, seo_keywords, subscription_plan, selected_plan, subscription_status, trial_ends_at, google_location_id, google_location_name, google_location_address, ai_tone, ai_length, ai_safe_mode, ai_custom_instructions, first_login, language')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Plan actuel pour l'accès = souscription Stripe uniquement (trialing = Zénith). selected_plan = intention pour après l'essai.
  const subscriptionPlanSlug = toPlanSlug(profile?.subscription_plan ?? null, undefined);
  const selectedPlanFromDb = typeof profile?.selected_plan === 'string' ? profile.selected_plan : null;
  return NextResponse.json({
    establishmentName: profile?.establishment_name ?? '',
    establishmentType: profile?.establishment_type ?? '',
    fullName: profile?.full_name ?? '',
    address: profile?.address ?? '',
    phone: profile?.phone ?? '',
    website: profile?.website ?? '',
    whatsappPhone: profile?.whatsapp_phone ?? '',
    alertThresholdStars: profile?.alert_threshold_stars ?? 3,
    seoKeywords: Array.isArray(profile?.seo_keywords) ? profile.seo_keywords.filter((k): k is string => typeof k === 'string') : [],
    subscriptionPlanSlug,
    selectedPlan: selectedPlanFromDb ?? subscriptionPlanSlug,
    email: user.email ?? '',
    googleLocationId: profile?.google_location_id ?? null,
    googleLocationName: profile?.google_location_name ?? null,
    googleLocationAddress: profile?.google_location_address ?? null,
    aiTone: profile?.ai_tone ?? 'professional',
    aiLength: profile?.ai_length ?? 'balanced',
    aiSafeMode: profile?.ai_safe_mode ?? true,
    aiCustomInstructions: profile?.ai_custom_instructions ?? '',
    firstLogin: profile?.first_login ?? true,
    subscriptionStatus: profile?.subscription_status ?? null,
    trialEndsAt: profile?.trial_ends_at ? new Date(profile.trial_ends_at as string).toISOString() : null,
    language: (profile?.language as string) ?? 'fr',
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const {
    establishmentName,
    establishmentType,
    fullName,
    address,
    phone,
    website,
    whatsappPhone,
    alertThresholdStars,
    seoKeywords,
    aiTone,
    aiLength,
    aiSafeMode,
    aiCustomInstructions,
    firstLogin,
    defaultEstablishmentId,
    language: bodyLanguage,
  } = body;

  const updates: Record<string, string | number | string[] | boolean | null> = {};
  if (typeof establishmentName === 'string') updates.establishment_name = establishmentName.trim();
  if (defaultEstablishmentId === null || defaultEstablishmentId === '') {
    updates.default_establishment_id = null;
  } else if (typeof defaultEstablishmentId === 'string' && defaultEstablishmentId.trim()) {
    const id = defaultEstablishmentId.trim();
    if (id === 'profile') {
      updates.default_establishment_id = null;
    } else {
      const { data: establishment } = await supabase
        .from('establishments')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (establishment) updates.default_establishment_id = id;
    }
  }
  if (typeof establishmentType === 'string') updates.establishment_type = establishmentType.trim();
  if (typeof fullName === 'string') updates.full_name = fullName.trim();
  if (typeof address === 'string') updates.address = address.trim();
  if (typeof phone === 'string') {
    updates.phone = phone.trim();
  }
  if (typeof whatsappPhone === 'string') {
    updates.whatsapp_phone = whatsappPhone.trim();
  }
  if (typeof bodyLanguage === 'string' && VALID_LOCALES.includes(bodyLanguage)) {
    updates.language = bodyLanguage;
  }
  if (typeof website === 'string') updates.website = website.trim();
  if (typeof alertThresholdStars === 'number' && alertThresholdStars >= 1 && alertThresholdStars <= 5) {
    updates.alert_threshold_stars = alertThresholdStars;
  }
  if (Array.isArray(seoKeywords)) {
    updates.seo_keywords = seoKeywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim());
  }
  if (typeof aiTone === 'string') {
    updates.ai_tone = aiTone;
  }
  if (typeof aiLength === 'string') {
    updates.ai_length = aiLength;
  }
  if (typeof aiSafeMode === 'boolean') {
    updates.ai_safe_mode = aiSafeMode;
  }
  if (typeof aiCustomInstructions === 'string') {
    updates.ai_custom_instructions = aiCustomInstructions.trim();
  }
  if (typeof firstLogin === 'boolean') {
    updates.first_login = firstLogin;
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
