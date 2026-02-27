import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const POLYGLOT_SYSTEM_PROMPT = `Tu es l'expert n°1 en e-réputation mondiale. Ton rôle est de répondre aux avis clients pour des établissements locaux.

RÈGLES ABSOLUES :
1. LANGUE : Détecte la langue de l'avis client et réponds systématiquement dans la MÊME langue (Espagnol pour Espagnol, Japonais pour Japonais, etc.). Respecte les nuances locales (ex: espagnol d'Espagne vs Mexique).
2. TON : Chaleureux, professionnel et court.
3. SEO : Inclus naturellement des mots-clés liés à l'activité et à la ville pour booster le référencement local.
4. ALERTE : Si l'avis est inférieur à 3 étoiles OU contient des mots de colère/insatisfaction forte, NE réponds pas et renvoie UNIQUEMENT : {"action":"FLAG","reason":"negative","detectedLanguage":"CODE_ISO"}.
5. Si l'avis est neutre ou positif (>= 3), rédige une réponse et renvoie : {"action":"REPLY","content":"Ta réponse ici","detectedLanguage":"CODE_ISO"}.

Réponds UNIQUEMENT en JSON valide, sans markdown ni texte avant/après.`;

type ProcessReviewBody = {
  reviewText: string;
  rating: number;
  establishmentName: string;
  city: string;
  industry?: string;
};

type GptResponse =
  | { action: 'FLAG'; reason: string; detectedLanguage: string }
  | { action: 'REPLY'; content: string; detectedLanguage: string };

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const body: ProcessReviewBody = await request.json();
    const { reviewText, rating, establishmentName, city, industry } = body;

    if (!reviewText || rating == null || !establishmentName || !city) {
      return NextResponse.json(
        {
          error: 'Missing required fields: reviewText, rating, establishmentName, city',
        },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: POLYGLOT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Avis reçu:
- Texte: "${reviewText}"
- Note: ${rating}/5
- Établissement: ${establishmentName}
- Ville: ${city}
${industry ? `- Activité: ${industry}` : ''}

Retourne un JSON avec action (FLAG ou REPLY), detectedLanguage (code ISO), et selon le cas :
- FLAG : reason
- REPLY : content (ta réponse optimisée SEO local)`,
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

    const review = await prisma.review.create({
      data: {
        reviewText,
        rating,
        establishmentName,
        city,
        detectedLanguage: parsed.detectedLanguage,
        responseText,
        status,
        isSecurityFlagged,
        securityAdvice: parsed.action === 'FLAG' ? parsed.reason : null,
      },
    });

    return NextResponse.json({
      id: review.id,
      action: parsed.action,
      detectedLanguage: parsed.detectedLanguage,
      isSecurityFlagged,
      reason: parsed.action === 'FLAG' ? parsed.reason : undefined,
      responseText,
      // Si FLAG : idéalement déclencher webhook Twilio/WhatsApp côté client ou cron
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
