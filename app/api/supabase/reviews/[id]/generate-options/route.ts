import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import {
  HUMAN_CHARTER_BASE,
  buildZenithSeoInstruction,
  HUMAN_FALLBACKS,
} from '@/lib/ai/concierge-prompts';
import { runZenithTripleJudge } from '@/lib/ai/zenith-triple-judge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT_SINGLE = `Tu es un expert en e-réputation. Génère une seule réponse pour l'avis client, en respectant les préférences de style et de ton fournies.
${HUMAN_CHARTER_BASE}
Réponds UNIQUEMENT en JSON valide : {"content": "Ta réponse ici", "detectedLanguage": "fr"}
Détecte la langue de l'avis et réponds dans la MÊME langue.`;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [reviewRes, profileRes] = await Promise.all([
      supabase.from('reviews').select('id, comment, rating, response_text, reviewer_name').eq('id', id).eq('user_id', user.id).single(),
      supabase
        .from('profiles')
        .select(
          'seo_keywords, subscription_plan, selected_plan, establishment_name, address, ai_tone, ai_length, ai_safe_mode, ai_custom_instructions'
        )
        .eq('id', user.id)
        .single(),
    ]);

    const { data: review } = reviewRes;
    const { data: profile } = profileRes;

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    if (review.response_text) {
      return NextResponse.json(
        { error: 'Review already has a response' },
        { status: 400 }
      );
    }

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    const seoKeywords = Array.isArray(profile?.seo_keywords)
      ? profile.seo_keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
      : [];
    const useSeo = hasFeature(planSlug, FEATURES.SEO_BOOST);
    const establishmentName = profile?.establishment_name?.trim() || 'client';
    const businessContext = [seoKeywords[0], profile?.address?.trim()].filter(Boolean).join(' à ') || establishmentName;

    const toneLabel = (() => {
      switch (profile?.ai_tone) {
        case 'warm':
          return 'chaleureux';
        case 'casual':
          return 'décontracté';
        case 'luxury':
          return 'haut de gamme / luxueux';
        case 'humorous':
          return 'avec une touche légère et souriante, sans être déplacé';
        default:
          return 'professionnel et bienveillant';
      }
    })();

    const lengthLabel = (() => {
      switch (profile?.ai_length) {
        case 'concise':
          return 'très concises (2 à 3 phrases maximum)';
        case 'detailed':
          return 'plus détaillées (3 à 5 phrases)';
        default:
          return 'équilibrées (2 à 4 phrases)';
      }
    })();

    const customInstructions = (profile?.ai_custom_instructions ?? '').trim();

    const styleInstruction = `
PRÉFÉRENCES DE STYLE À RESPECTER :
- Ton: ${toneLabel}.
- Longueur des réponses: ${lengthLabel}.
- Registre: utilise EXCLUSIVEMENT le vouvoiement (vous). Le tutoiement est strictement interdit.
- Ne jamais signer avec une formule fixe : rédige une conclusion variée, chaleureuse et contextuelle.
${customInstructions ? `- CONSIGNES PRIORITAIRES du restaurateur (à intégrer naturellement) : ${customInstructions}` : ''}`.trim();

    const isZenith = planSlug === 'zenith';

    if (isZenith) {
      const winner = await runZenithTripleJudge(openai, {
        reviewComment: review.comment,
        reviewerName: review.reviewer_name ?? 'Client',
        rating: review.rating,
        establishmentName: profile?.establishment_name ?? establishmentName,
        businessContext,
        seoKeywords,
        styleInstruction,
        aiTon: profile?.ai_tone ?? undefined,
        aiLength: profile?.ai_length ?? undefined,
        aiCustomInstructions: customInstructions || undefined,
      });
      return NextResponse.json({
        options: [winner],
        detectedLanguage: 'fr',
      });
    }

    const systemPromptSingle =
      SYSTEM_PROMPT_SINGLE +
      '\n\n' +
      styleInstruction +
      (useSeo ? buildZenithSeoInstruction(establishmentName, businessContext, seoKeywords) : '');

    const completionSingle = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        { role: 'system', content: systemPromptSingle },
        {
          role: 'user',
          content: `Avis: "${review.comment}" | Client: ${review.reviewer_name ?? 'Client'} | Note: ${review.rating}/5 | Établissement: ${profile?.establishment_name || 'client'}. Génère une réponse en JSON. La clé "content" doit contenir uniquement le texte brut.`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const contentSingle = completionSingle.choices[0]?.message?.content;
    if (!contentSingle) throw new Error('No response from OpenAI');

    const parsedSingle = JSON.parse(contentSingle) as { content?: string; detectedLanguage?: string };
    let singleResponse = (parsedSingle.content ?? HUMAN_FALLBACKS.genericThanks).trim();
    singleResponse = singleResponse.replace(/^["']|["']$/g, '').replace(/^Voici la réponse\s*:?\s*/i, '');

    return NextResponse.json({
      options: [singleResponse],
      detectedLanguage: parsedSingle.detectedLanguage ?? 'fr',
    });
  } catch (error) {
    console.error('[supabase/reviews/generate-options]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generate failed' },
      { status: 500 }
    );
  }
}
