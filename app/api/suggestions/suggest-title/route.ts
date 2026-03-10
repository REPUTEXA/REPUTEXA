import { NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * POST /api/suggestions/suggest-title
 * Analyse une image (screenshot) et suggère un titre de suggestion produit.
 * Body: FormData avec champ "image" (fichier image).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get('image');
    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: 'Image requise' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Vision non configurée' }, { status: 503 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const type = image.type ?? 'image/png';

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
    return NextResponse.json({ title });
  } catch (e) {
    console.error('[suggestions/suggest-title]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur analyse' },
      { status: 500 }
    );
  }
}
