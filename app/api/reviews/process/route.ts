import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { HUMAN_CHARTER_BASE } from '@/lib/ai/concierge-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const POLYGLOT_BASE = `Tu es l'expert n°1 en e-réputation mondiale pour REPUTEXA. Réponds aux avis clients pour des établissements locaux.
${HUMAN_CHARTER_BASE}
RÈGLES :
1. LANGUE : {LANGUE_RULE}
2. TON CULTUREL (adapte selon la langue de réponse) :
   - EN/US : ROI, résultats mesurables, efficacité. Ton direct et orienté valeur.
   - FR : Qualité, expertise, professionnalisme. Ton raffiné et rassurant.
   - ES/IT/JP : Courtoisie, attention client, hospitalité. Ton chaleureux et respectueux.
   - DE : Précision, fiabilité, rigueur. Ton professionnel et factuel.
3. SEO INVISIBLE : Fonds naturellement {city} et {industry} dans la conversation (ex: "pour un resto à Nice, on garde des prix corrects"), jamais de phrase construite autour du mot-clé.
4. ALERTE : Si avis < 3 étoiles OU colère/insatisfaction forte -> {"action":"FLAG","reason":"negative","detectedLanguage":"CODE_ISO"}
5. Si avis >= 3 -> {"action":"REPLY","content":"Ta réponse","detectedLanguage":"CODE_ISO"}

Réponds UNIQUEMENT en JSON valide.`;

type ProcessReviewBody = {
  reviewText: string;
  rating: number;
  establishmentName: string;
  city: string;
  industry?: string;
  establishmentId?: string;
};

type GptResponse =
  | { action: 'FLAG'; reason: string; detectedLanguage: string }
  | { action: 'REPLY'; content: string; detectedLanguage: string };

function randomDelayMinutes(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const raw = await request.json().catch(() => ({}));
    const body = raw as ProcessReviewBody;
    const { reviewText, rating, establishmentName, city, industry, establishmentId } = body;

    if (!reviewText || rating == null || !establishmentName || !city) {
      return NextResponse.json(
        {
          error: 'Missing required fields: reviewText, rating, establishmentName, city',
        },
        { status: 400 }
      );
    }

    // Charger l'établissement si fourni (tier + platformLang pour segmentation)
    let tier: 'STARTER' | 'MANAGER' | 'DOMINATOR' | null = null;
    let platformLang = 'fr';

    if (establishmentId) {
      const establishment = await prisma.establishment.findUnique({
        where: { id: establishmentId },
      });
      if (establishment) {
        tier = establishment.tier as 'STARTER' | 'MANAGER' | 'DOMINATOR';
        platformLang = establishment.platformLang ?? 'fr';
      }
    }

    const isStarter = tier === 'STARTER';
    const langRule = isStarter
      ? `IMPORTANT : Réponds UNIQUEMENT en ${platformLang.toUpperCase()}. L'établissement est en plan STARTER, donc limite tes réponses à la langue de l'enseigne. Ignore la langue de l'avis.`
      : `Détecte la langue de l'avis et réponds dans la MÊME langue (natif). L'établissement est en plan MANAGER/DOMINATOR avec IA polyglotte. Respecte les nuances locales.`;

    const systemPrompt = POLYGLOT_BASE.replace('{LANGUE_RULE}', langRule);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Avis reçu:
- Texte: "${reviewText}"
- Note: ${rating}/5
- Établissement: ${establishmentName}
- Ville: {city} = ${city}
- Activité/Industry: {industry} = ${industry ?? 'restaurant'}

Génère une réponse optimisée SEO en injectant {city} et {industry}. Retourne JSON : action, detectedLanguage, et (FLAG: reason | REPLY: content).`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content) as GptResponse;

    const isSecurityFlagged = parsed.action === 'FLAG';
    const responseText = parsed.action === 'REPLY' ? parsed.content : null;
    const status = parsed.action === 'FLAG' ? 'FLAGGED' : responseText ? 'REPLIED' : 'PENDING';

    // Délai humain : 25-45 min avant publication effective (tous plans)
    const delayMin = randomDelayMinutes(25, 45);
    const scheduledPublishAt = new Date(Date.now() + delayMin * 60 * 1000);

    const review = await prisma.review.create({
      data: {
        reviewText,
        rating,
        establishmentName,
        city,
        establishmentId: establishmentId ?? undefined,
        detectedLanguage: parsed.detectedLanguage,
        responseText,
        status,
        isSecurityFlagged,
        securityAdvice: parsed.action === 'FLAG' ? parsed.reason : null,
        scheduledPublishAt,
      },
    });

    return NextResponse.json({
      id: review.id,
      action: parsed.action,
      detectedLanguage: parsed.detectedLanguage,
      isSecurityFlagged,
      reason: parsed.action === 'FLAG' ? parsed.reason : undefined,
      responseText,
      scheduledPublishAt: scheduledPublishAt.toISOString(),
    });
  } catch (error) {
    console.error('[reviews/process]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process review',
      },
      { status: 500 }
    );
  }
}
