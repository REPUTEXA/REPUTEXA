import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/api-plan-guard';
import { FEATURES } from '@/lib/feature-gate';

/**
 * Simule l'envoi d'une requête de suppression via Bouclier IA
 * pour avis contenant insultes ou spam. Réservé Pulse+.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const planCheck = await requireFeature(FEATURES.SHIELD_HATEFUL);
    if (planCheck instanceof NextResponse) return planCheck;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: review } = await supabase
      .from('reviews')
      .select('id, comment')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Simule une requête envoyée à Google
    const hasInsults = /(insulte|spam|fake|faux|mentir)/i.test(review.comment ?? '');
    const status = hasInsults ? 'PENDING_REVIEW' : 'REPORT_SENT';

    return NextResponse.json({
      id,
      status,
      message: hasInsults
        ? 'L\'IA a détecté un contenu potentiellement abusif. Demande de révision envoyée à Google.'
        : 'Demande de signalement envoyée. Google traitera votre demande sous 48-72h.',
    });
  } catch (error) {
    console.error('[supabase/reviews/shield-report]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Report failed' },
      { status: 500 }
    );
  }
}
