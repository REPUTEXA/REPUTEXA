import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const POLYGLOT_SYSTEM_PROMPT = `Tu es l'expert n°1 en e-réputation mondiale. Ton rôle est de répondre aux avis clients pour des établissements locaux.

RÈGLES ABSOLUES :
1. LANGUE : Détecte la langue de l'avis client et réponds systématiquement dans la MÊME langue.
2. TON : Chaleureux, professionnel et court.
3. SEO : Inclus naturellement des mots-clés liés à l'activité et à la ville.
4. ALERTE : Si l'avis est inférieur à 3 étoiles OU contient des mots de colère, renvoie : {"action":"FLAG","reason":"negative","detectedLanguage":"CODE_ISO"}.
5. Sinon : {"action":"REPLY","content":"Ta réponse ici","detectedLanguage":"CODE_ISO"}.

Réponds UNIQUEMENT en JSON valide.`;

type GptResponse =
  | { action: 'FLAG'; reason: string; detectedLanguage: string }
  | { action: 'REPLY'; content: string; detectedLanguage: string };

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

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    if (review.responseText) {
      return NextResponse.json(
        { error: 'Review already has a response' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: POLYGLOT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Avis: "${review.reviewText}" | Note: ${review.rating}/5 | Établissement: ${review.establishmentName} | Ville: ${review.city}. Retourne JSON (action, content ou reason, detectedLanguage).`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content) as GptResponse;
    const isSecurityFlagged = parsed.action === 'FLAG';
    const responseText = parsed.action === 'REPLY' ? parsed.content : null;
    const status = parsed.action === 'FLAG' ? 'FLAGGED' : 'REPLIED';

    await prisma.review.update({
      where: { id },
      data: {
        detectedLanguage: parsed.detectedLanguage,
        responseText,
        status,
        isSecurityFlagged,
        securityAdvice: parsed.action === 'FLAG' ? parsed.reason : null,
      },
    });

    return NextResponse.json({
      id,
      action: parsed.action,
      responseText,
      isSecurityFlagged,
    });
  } catch (error) {
    console.error('[reviews/generate]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generate failed' },
      { status: 500 }
    );
  }
}
