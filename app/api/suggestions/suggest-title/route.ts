import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { apiIaJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { classifyOpenAiIaFailure } from '@/lib/api/classify-openai-ia-error';

/**
 * POST /api/suggestions/suggest-title
 * Analyse une image (screenshot) et suggère un titre de suggestion produit.
 * Body: FormData avec champ "image" (fichier image).
 */
function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const image = form.get('image');
  if (!image || !(image instanceof Blob)) {
    return apiJsonError(request, 'errors.imageRequired', 400);
  }

  const openai = getOpenAI();
  if (!openai) {
    return apiIaJsonError(request, 'openAiNotConfigured', 503);
  }

  const arrayBuffer = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const type = image.type ?? 'image/png';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Tu analyses une capture d\'écran de feedback ou suggestion produit pour Reputexa. Génère un titre court (max 10 mots) résumant la demande. Réponds UNIQUEMENT avec le titre, rien d\'autre.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${type};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 80,
    });

    const title = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!title) {
      return apiIaJsonError(request, 'modelEmptyResponse', 502);
    }
    return NextResponse.json({ title });
  } catch (e) {
    console.error('[suggestions/suggest-title]', e);
    const key = classifyOpenAiIaFailure(e);
    return apiIaJsonError(request, key, 503);
  }
}
