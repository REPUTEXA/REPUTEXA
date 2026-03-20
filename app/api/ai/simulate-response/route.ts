/**
 * Route de simulation ADN — utilise le moteur central (ai-service).
 * Compatible avec la page Paramètres pour l'aperçu en direct.
 * Pour les nouveaux intégrations, préférer /api/ai/generate.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReviewResponse } from '@/lib/ai-service';

type SimulateBody = {
  ton?: string;
  longueur?: string;
  instructions?: string;
  avis?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('establishment_name, ai_tone, ai_length, ai_custom_instructions')
      .eq('id', user.id)
      .single();

    const body = (await request.json().catch(() => ({}))) as SimulateBody;
    const ton = String(body.ton ?? profile?.ai_tone ?? 'professional').trim() || 'professional';
    const longueur = String(body.longueur ?? profile?.ai_length ?? 'balanced').trim() || 'balanced';
    const instructions = String(body.instructions ?? profile?.ai_custom_instructions ?? '').trim();
    const avis = String(body.avis ?? '').trim();

    if (!avis) {
      return NextResponse.json({ error: 'Avis requis' }, { status: 400 });
    }

    const establishmentName =
      (profile?.establishment_name as string | null)?.trim() || 'notre établissement';

    const result = await generateReviewResponse({
      avis,
      reviewerName: 'Client',
      rating: 4,
      establishmentName,
      ton,
      longueur,
      instructions,
    });

    let content = result.content;
    content = content.replace(/\[.*?\]/g, '').trim();
    content = content.replace(/votre retour est précieux/gi, '');
    content = content.replace(/reputexa/gi, "l'établissement");
    content = content.replace(/\s{2,}/g, ' ').trim();

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[api/ai/simulate-response]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur simulation' },
      { status: 500 }
    );
  }
}
