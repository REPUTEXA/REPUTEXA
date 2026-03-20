import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import { runZenithTripleJudge } from '@/lib/ai/zenith-triple-judge';
import { generateReviewResponse, hasAiConfigured } from '@/lib/ai-service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!hasAiConfigured()) {
      return NextResponse.json(
        { error: 'Aucune clé API IA configurée (ANTHROPIC_API_KEY ou OPENAI_API_KEY)' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [reviewRes, profileRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, comment, rating, response_text, reviewer_name')
        .eq('id', id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('profiles')
        .select(
          'seo_keywords, subscription_plan, selected_plan, establishment_name, address, ai_tone, ai_length, ai_safe_mode, ai_custom_instructions, language, payment_status, payment_failed_at, subscription_status, phone, email'
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

    // Blocage IA si abonnement résilié (lecture seule uniquement)
    if ((profile?.subscription_status as string | null) === 'canceled') {
      return NextResponse.json(
        {
          error:
            'Votre abonnement est résilié. Vous pouvez encore consulter vos anciens avis, mais la génération IA est désactivée.',
        },
        { status: 403 }
      );
    }

    // Protection : blocage IA si le paiement est en échec AU-DELÀ de la période de grâce
    if ((profile?.payment_status as string | null) === 'unpaid') {
      const failedAtRaw = profile?.payment_failed_at as string | null;
      if (failedAtRaw) {
        const failedAt = new Date(failedAtRaw);
        const now = new Date();
        const diffMs = now.getTime() - failedAt.getTime();
        const graceMs = 3 * 24 * 60 * 60 * 1000; // 3 jours
        if (diffMs > graceMs) {
          return NextResponse.json(
            {
              error:
                'Paiement en attente depuis plus de 3 jours. Veuillez régulariser votre situation pour continuer à utiliser les réponses IA.',
            },
            { status: 402 }
          );
        }
      }
      return NextResponse.json(
        {
          error:
            'Paiement en attente. Veuillez mettre à jour votre moyen de paiement pour continuer à utiliser les réponses IA.',
        },
        { status: 402 }
      );
    }

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    const seoKeywords = Array.isArray(profile?.seo_keywords)
      ? profile.seo_keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
      : [];
    const _useSeo = hasFeature(planSlug, FEATURES.SEO_BOOST);
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
    const businessLanguage = (profile?.language as string) ?? 'fr';
    const isVision = planSlug === 'vision';
    const languageRule = isVision
      ? `Vous devez répondre dans la langue locale de l'établissement (${businessLanguage}). Cependant, pour rester poli, si l'avis du client est dans une autre langue, commencez votre réponse par une courte phrase de bienvenue ou de remerciement dans la langue du client, puis enchaînez le reste de la réponse exclusivement en ${businessLanguage}.`
      : 'Détecte la langue de l\'avis et réponds dans la MÊME langue (natif).';

    const profilePhone = (profile?.phone as string)?.trim() ?? '';
    const profileEmail = (profile?.email as string)?.trim() ?? '';
    const isNegativeReview = typeof review.rating === 'number' && review.rating <= 3;

    // Bloc contact pour les avis négatifs (Zenith utilise styleInstruction)
    const contactParts = [
      profilePhone ? `au ${profilePhone}` : null,
      profileEmail ? `par email à ${profileEmail}` : null,
    ].filter(Boolean).join(' ou ');

    const negativeContactInstruction =
      isNegativeReview && contactParts
        ? `\n\nAVIS NÉGATIF — RÈGLE OBLIGATOIRE : Après ta réponse, ajoute un paragraphe de réconciliation (séparé par une ligne vide) : "Nous aimerions échanger avec vous pour comprendre ce qu'il s'est passé. N'hésitez pas à nous contacter directement ${contactParts}."`
        : '';

    if (isZenith) {
      const winner = await runZenithTripleJudge({
        reviewComment: review.comment,
        reviewerName: review.reviewer_name ?? 'Client',
        rating: review.rating,
        establishmentName: profile?.establishment_name ?? establishmentName,
        businessContext,
        seoKeywords,
        styleInstruction: styleInstruction + negativeContactInstruction,
        aiTon: profile?.ai_tone ?? undefined,
        aiLength: profile?.ai_length ?? undefined,
        aiCustomInstructions: customInstructions || undefined,
      });
      return NextResponse.json({
        options: [winner],
        detectedLanguage: 'fr',
      });
    }

    const { content: singleResponse } = await generateReviewResponse({
      avis: review.comment,
      reviewerName: review.reviewer_name ?? 'Client',
      rating: review.rating,
      establishmentName,
      ton: profile?.ai_tone ?? undefined,
      longueur: profile?.ai_length ?? undefined,
      instructions: customInstructions || undefined,
      languageRule,
      phone: profilePhone || undefined,
      email: profileEmail || undefined,
    });

    return NextResponse.json({
      options: [singleResponse],
      detectedLanguage: 'fr',
    });
  } catch (error) {
    console.error('[supabase/reviews/generate-options]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generate failed' },
      { status: 500 }
    );
  }
}
