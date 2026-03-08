import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Simulation de l'envoi WhatsApp (Twilio/Meta à brancher plus tard).
 * Enregistre whatsapp_sent sur la review et retourne un succès simulé.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { reviewId } = body as { reviewId?: string };

    if (!reviewId) {
      return NextResponse.json({ error: 'reviewId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_phone')
      .eq('id', user.id)
      .single();

    const to = profile?.whatsapp_phone?.trim();
    // Simulation : si pas de numéro configuré, on considère que l'appel serait fait
    if (!to) {
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'WhatsApp non configuré — appel simulé (Twilio/Meta à brancher)',
      });
    }

    const { data: review } = await supabase
      .from('reviews')
      .select('id, rating, comment, reviewer_name')
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .single();

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Simulation — plus tard: Twilio/Meta API call
    // await sendWhatsAppMessage(to, `Alerte avis négatif: ${review.reviewer_name} - ${review.rating}/5`);

    await supabase
      .from('reviews')
      .update({ whatsapp_sent: true })
      .eq('id', reviewId)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      simulated: true,
      message: `Alerte envoyée vers ${to} (simulation — Twilio/Meta à brancher)`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Notify failed' },
      { status: 500 }
    );
  }
}
