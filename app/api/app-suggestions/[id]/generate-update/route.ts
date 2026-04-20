import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai-service';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

const SYSTEM_PROMPT = `Tu es le rédacteur officiel de REPUTEXA, une plateforme SaaS de gestion de réputation en ligne positionnée dans le segment premium/luxe. Tu rédiges les annonces de changelog produit.

Règles absolues :
- Ton : élégant, confiant, premium — style Apple Keynote ou Notion Changelog
- Structure : accroche percutante (1 phrase) → bénéfice concret utilisateur (2-3 phrases) → invitation à découvrir (1 phrase)
- Longueur : 120 à 220 mots, jamais plus
- AEO (Answer Engine Optimization) : formulations directes, vocabulaire précis, phrases courtes et actives
- Jamais de jargon technique brut — traduis en bénéfices utilisateur
- Rédige UNIQUEMENT en français
- Ne mentionne pas de numéros de version
- Commence directement par l'accroche, sans préambule ni titre`;

/**
 * POST /api/app-suggestions/[id]/generate-update
 * Génère une annonce de mise à jour luxe via Claude (Anthropic).
 * Réservé aux administrateurs.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = createServerTranslator('ApiAppSuggestions', apiLocaleFromRequest(request));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return apiJsonError(request, 'forbidden', 403);
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let title = String(body.title ?? '').trim();
  let description = String(body.description ?? '').trim();

  if (!title || !description) {
    const { data: suggestion } = await supabase
      .from('app_suggestions')
      .select('title, description')
      .eq('id', id)
      .single();

    title = title || String(suggestion?.title ?? '');
    description = description || String(suggestion?.description ?? '');
  }

  if (!title) {
    return NextResponse.json({ error: t('titleRequired') }, { status: 400 });
  }

  const userContent = `Fonctionnalité livrée suite à une suggestion utilisateur :

Titre : ${title}
Description : ${description || t('descriptionFallbackUnspecified')}

Rédige l'annonce de changelog REPUTEXA pour cette livraison.`;

  try {
    const content = await generateText({
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      temperature: 0.75,
      maxTokens: 512,
    });

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[generate-update] AI error:', err);
    return NextResponse.json({ error: t('aiGenerateError') }, { status: 500 });
  }
}
