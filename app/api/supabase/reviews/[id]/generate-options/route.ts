import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/api-plan-guard';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import {
  HUMAN_CHARTER_BASE,
  ZENITH_CONCIERGE_ADDON,
  buildSeoInvisibleInstruction,
  HUMAN_FALLBACKS,
} from '@/lib/ai/concierge-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT_BASE = `Tu es un expert en e-réputation. Génère exactement 3 variantes de réponses pour l'avis client, en respectant strictement les préférences de style et de ton fournies.
${HUMAN_CHARTER_BASE}
Réponds UNIQUEMENT en JSON valide : {"options": ["Réponse A", "Réponse B", "Réponse C"], "detectedLanguage": "fr"}
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

    const planCheck = await requireFeature(FEATURES.TRIPLE_VERIFICATION);
    if (planCheck instanceof NextResponse) return planCheck;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [reviewRes, profileRes] = await Promise.all([
      supabase.from('reviews').select('id, comment, rating, response_text').eq('id', id).eq('user_id', user.id).single(),
      supabase
        .from('profiles')
        .select(
          'seo_keywords, subscription_plan, selected_plan, establishment_name, ai_tone, ai_length, ai_signature, ai_use_tutoiement, ai_safe_mode, ai_instructions'
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
    const useSeo = hasFeature(planSlug, FEATURES.SEO_BOOST) && seoKeywords.length > 0;

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

    const signature = (profile?.ai_signature ?? '').trim();
    const extraInstructions = (profile?.ai_instructions ?? '').trim();
    const useTutoiement = profile?.ai_use_tutoiement ?? false;

    const styleInstruction = `
PRÉFÉRENCES DE STYLE À RESPECTER :
- Ton: ${toneLabel}.
- Longueur des réponses: ${lengthLabel}.
- Registre: ${useTutoiement ? 'utilise le tutoiement (tu) partout' : 'utilise le vouvoiement (vous) partout'}.
${signature ? `- Ajoute systématiquement cette signature à la fin : "${signature}".` : ''}
${extraInstructions ? `- Consigne(s) spécifique(s) du restaurateur : ${extraInstructions}` : ''}`.trim();

    const isZenith = planSlug === 'zenith';
    const systemPrompt =
      SYSTEM_PROMPT_BASE +
      '\n\n' +
      styleInstruction +
      (isZenith ? '\n\n' + ZENITH_CONCIERGE_ADDON : '') +
      (useSeo ? buildSeoInvisibleInstruction(seoKeywords) : '');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Avis: "${review.comment}" | Note: ${review.rating}/5 | Établissement: ${profile?.establishment_name || 'client'}. Génère 3 options de réponse en JSON.`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content) as { options?: string[]; detectedLanguage?: string };
    const options = Array.isArray(parsed.options) ? parsed.options.slice(0, 3) : [];

    return NextResponse.json({
      options: options.length >= 3 ? options : [
        options[0] ?? HUMAN_FALLBACKS.genericThanks,
        options[1] ?? HUMAN_FALLBACKS.positiveShort,
        options[2] ?? 'À très vite !',
      ],
      detectedLanguage: parsed.detectedLanguage ?? 'fr',
    });
  } catch (error) {
    console.error('[supabase/reviews/generate-options]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generate failed' },
      { status: 500 }
    );
  }
}
