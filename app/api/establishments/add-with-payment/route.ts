import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { PLAN_PRICES, getTotalMonthlyPrice } from '@/lib/establishments';

/**
 * Avec Graduated Tiers Stripe : la quantité est gérée dans l'abonnement principal.
 * L'utilisateur augmente sa quantité via le Customer Portal.
 * Tant que establishments.length + 1 <= subscription_quantity, il peut ajouter gratuitement.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : undefined;
    const googleLocationId = typeof body.googleLocationId === 'string' ? body.googleLocationId.trim() : undefined;
    const googleLocationName = typeof body.googleLocationName === 'string' ? body.googleLocationName.trim() : undefined;
    const googleLocationAddress = typeof body.googleLocationAddress === 'string' ? body.googleLocationAddress.trim() : undefined;

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Le nom de l'établissement est requis (min. 2 caractères)" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan, subscription_status, subscription_quantity')
      .eq('id', user.id)
      .single();

    const planSlug = toPlanSlug(
      profile?.subscription_plan ?? null,
      profile?.selected_plan ?? null
    );

    const { count } = await supabase
      .from('establishments')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id);

    const establishmentCount = count ?? 0;
    const totalSlots = 1 + establishmentCount; // 1 principal + addons
    const subscriptionQuantity = Math.max(1, (profile?.subscription_quantity as number | null) ?? 1);

    if (totalSlots >= subscriptionQuantity) {
      return NextResponse.json(
        {
          error: 'Limite d\'établissements atteinte. Mettez à jour votre abonnement pour en ajouter.',
          limitReached: true,
          subscriptionQuantity,
          billingPortalPath: '/api/stripe/portal',
        },
        { status: 403 }
      );
    }

    const displayOrder = establishmentCount;
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

    const totalNextMonth = getTotalMonthlyPrice(planSlug, totalSlots + 1);

    return NextResponse.json({
      ok: true,
      establishment: inserted,
      limitReached: false,
      totalNextMonth,
    });
  } catch (err) {
    console.error('[establishments/add-with-payment]', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Erreur lors de l\'ajout',
      },
      { status: 500 }
    );
  }
}
