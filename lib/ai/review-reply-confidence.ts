/**
 * Score de confiance 0–100 pour une réponse avis (publication / escalade commerçant).
 */
import OpenAI from 'openai';
import { generateText } from '@/lib/ai-service';

const openai = process.env.OPENAI_API_KEY?.trim() ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const SYSTEM = `Tu évalues la qualité et la sécurité d'une réponse d'établissement à un avis client.
Réponds UNIQUEMENT en JSON : {"confidence": <0-100 entier>, "reason": "<une phrase courte en français>"}.
100 = alignée à l'avis, ton pro, pas d'invention, pas de promesse dangereuse, registre correct.
Réserve < 80 si : inventions, ton inadapté, manque de miroir de l'avis, promesse juridique/commerciale risquée.`;

export async function scoreAutomatedReplyConfidence(params: {
  draft: string;
  reviewComment: string;
  rating: number;
  establishmentName: string;
}): Promise<number> {
  const draft = String(params.draft ?? '').trim();
  if (!draft) return 40;

  const user = `Établissement: ${params.establishmentName}
Note avis: ${params.rating}/5
AVIS:
"""${params.reviewComment.slice(0, 3500)}"""
RÉPONSE PROPOSÉE:
"""${draft.slice(0, 3500)}"""`;

  try {
    if (openai) {
      const c = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      });
      const raw = c.choices[0]?.message?.content ?? '{}';
      const j = JSON.parse(raw) as { confidence?: number };
      const n = typeof j.confidence === 'number' ? Math.round(j.confidence) : NaN;
      if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
    }
    const raw = await generateText({
      systemPrompt: `${SYSTEM}\nRéponds uniquement avec un objet JSON.`,
      userContent: user,
      temperature: 0.1,
      maxTokens: 120,
    });
    const j = JSON.parse(raw?.trim() ?? '{}') as { confidence?: number };
    const n = typeof j.confidence === 'number' ? Math.round(j.confidence) : NaN;
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  } catch {
    /* heuristic */
  }

  const mirror =
    params.reviewComment.length > 20 &&
    normalize(params.reviewComment).split(/\s+/).some((w) => w.length > 3 && normalize(draft).includes(w));
  return mirror ? 78 : 62;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}
