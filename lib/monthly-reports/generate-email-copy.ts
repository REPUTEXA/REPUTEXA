/**
 * Génération par IA de l'objet et de l'accroche pour l'email du rapport mensuel.
 */

import OpenAI from 'openai';
import type { SummaryStats } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateReportEmailCopy(
  stats: { averageRating: number; totalReviews: number; establishmentName: string },
  summary: SummaryStats,
  locale: string = 'fr'
): Promise<{ subject: string; hook: string; teaser: string }> {
  const lang = locale === 'fr' ? 'en français' : 'in English';
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Tu génères des accroches marketing percutantes pour des emails. Style Consultant de Luxe : vouvoiement, ton distingué, chiffres, curiosité. Réponds UNIQUEMENT en JSON : {"subject":"...","hook":"...","teaser":"..."}.`,
      },
      {
        role: 'user',
        content: `Établissement: ${stats.establishmentName}
Note: ${stats.averageRating.toFixed(1)}/5 — ${stats.totalReviews} avis
Force identifiée: ${'strength' in summary ? summary.strength : '—'}
Opportunité: ${'opportunity' in summary ? summary.opportunity : '—'}

Génère ${lang} :
- subject: objet email court et accrocheur (ex: "Votre réputation a progressé de 12% : découvrez pourquoi")
- hook: phrase d'accroche première ligne (vouvoiement)
- teaser: 2-3 phrases résumant les insights pour forcer le clic (sans spoiler tout)`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const p = JSON.parse(content) as { subject?: string; hook?: string; teaser?: string };
  return {
    subject: String(p.subject ?? `Votre rapport mensuel REPUTEXA`).slice(0, 120),
    hook: String(p.hook ?? '').slice(0, 200),
    teaser: String(p.teaser ?? '').slice(0, 400),
  };
}
