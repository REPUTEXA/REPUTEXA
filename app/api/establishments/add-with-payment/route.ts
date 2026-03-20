import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Création d'établissement désactivée (flux Stripe-First).
 * Les nouveaux emplacements sont créés uniquement par le webhook invoice.paid après paiement.
 * Utiliser le bouton "Ajouter un nouvel emplacement" sur le tableau de bord → redirection Stripe.
 */
export async function POST(_request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_quantity')
      .eq('id', user.id)
      .single();

    const { count } = await supabase
      .from('establishments')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id);

    const establishmentCount = count ?? 0;
    const totalSlots = 1 + establishmentCount;
    const subscriptionQuantity = Math.max(1, (profile?.subscription_quantity as number | null) ?? 1);

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
  } catch (err) {
    console.error('[establishments/add-with-payment]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'ajout' },
      { status: 500 }
    );
  }
}
