import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { apiIaJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { classifyOpenAiIaFailure } from '@/lib/api/classify-openai-ia-error';
import { HUMAN_CHARTER_BASE } from '@/lib/ai/concierge-prompts';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

const POLYGLOT_SYSTEM_PROMPT = `Tu es l'expert n°1 en e-réputation mondiale. Ton rôle est de répondre aux avis clients pour des établissements locaux.
${HUMAN_CHARTER_BASE}
RÈGLES ABSOLUES :
1. LANGUE : Détecte la langue de l'avis client et réponds systématiquement dans la MÊME langue.
2. TON : Chaleureux, parlé, organique. Varie les fins de message.
3. SEO INVISIBLE : Fonds naturellement mots-clés ville/activité dans la conversation, jamais de phrase construite autour d'un mot-clé.
4. ALERTE : Si l'avis est inférieur à 3 étoiles OU contient des mots de colère, renvoie : {"action":"FLAG","reason":"negative","detectedLanguage":"CODE_ISO"}.
5. Sinon : {"action":"REPLY","content":"Ta réponse ici","detectedLanguage":"CODE_ISO"}.

Réponds UNIQUEMENT en JSON valide.`;

type GptResponse =
  | { action: 'FLAG'; reason: string; detectedLanguage: string }
  | { action: 'REPLY'; content: string; detectedLanguage: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const openai = getOpenAI();
  if (!openai) {
    return apiIaJsonError(request, 'openAiNotConfigured', 503);
  }

  let review;
  try {
    review = await prisma.review.findUnique({ where: { id } });
  } catch (e) {
    console.error('[reviews/generate] prisma find', e);
    return apiJsonError(request, 'serverError', 500);
  }
  if (!review) {
    return apiJsonError(request, 'errors.reviewNotFound', 404);
  }
  if (review.responseText) {
    return apiJsonError(request, 'errors.reviewAlreadyResponded', 400);
  }

  let content: string;
  try {
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

    content = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!content) {
      return apiIaJsonError(request, 'modelEmptyResponse', 502);
    }
  } catch (e) {
    console.error('[reviews/generate]', e);
    const key = classifyOpenAiIaFailure(e);
    return apiIaJsonError(request, key, 503);
  }

  let parsed: GptResponse;
  try {
    parsed = JSON.parse(content) as GptResponse;
  } catch {
    return apiIaJsonError(request, 'modelOutputInvalid', 502);
  }

  const isSecurityFlagged = parsed.action === 'FLAG';
  const responseText =
    parsed.action === 'REPLY' ? scrubAiTypography(parsed.content) : null;
  const status = parsed.action === 'FLAG' ? 'FLAGGED' : 'REPLIED';

  try {
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
  } catch (e) {
    console.error('[reviews/generate] prisma', e);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json({
    id,
    action: parsed.action,
    responseText,
    isSecurityFlagged,
  });
}
