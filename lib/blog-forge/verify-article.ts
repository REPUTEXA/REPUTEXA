import OpenAI from 'openai';
import type { Article } from '@/lib/i18n/blog-articles/types';
import type { ForgeVerification } from './types';

export async function verifyFrenchArticle(article: Article): Promise<ForgeVerification> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Tu es un relecteur factuel. Tu reçois un article e-réputation. Tu dois signaler tout fait précis douteux (études inventées, pourcentages sans base, lois ou dates incertaines).
Réponds en JSON : {"verified": boolean, "notes": string, "concerns": string[]}
Si tu ne peux pas vérifier une statistique, mets verified=false et détaille dans concerns.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          title: article.title,
          intro: article.intro,
          conclusion: article.conclusion,
          sectionsHeadings: article.sections.map((s) => s.heading).filter(Boolean),
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  try {
    const v = JSON.parse(raw) as ForgeVerification;
    return {
      verified: Boolean(v.verified),
      notes: typeof v.notes === 'string' ? v.notes : undefined,
      concerns: Array.isArray(v.concerns) ? v.concerns : [],
    };
  } catch {
    return { verified: false, notes: 'Parse erreur vérificateur', concerns: ['verification_parse_error'] };
  }
}
