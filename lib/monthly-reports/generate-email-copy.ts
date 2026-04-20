/**
 * Génération par IA de l'objet et de l'accroche pour l'email du rapport mensuel.
 */

import OpenAI from 'openai';
import type { SummaryStats } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LOCALE_TO_INSTRUCTION: Record<string, string> = {
  fr: 'en français (vouvoiement si naturel dans cette langue)',
  en: 'in English',
  de: 'auf Deutsch (Sie-Form)',
  es: 'en español (usted)',
  it: 'in italiano (Lei)',
  pt: 'em português europeu (tratamento formal)',
  ja: '日本語で（丁寧語）',
  zh: '用简体中文',
};

export async function generateReportEmailCopy(
  stats: {
    averageRating: number;
    totalReviews: number;
    establishmentName: string;
    /** Nombre d’établissements avec activité dans le rapport (comparaison multi-sites) */
    siteCount?: number;
  },
  summary: SummaryStats,
  locale: string = 'fr'
): Promise<{ subject: string; hook: string; teaser: string }> {
  const key = (locale || 'fr').split('-')[0].toLowerCase();
  const lang = LOCALE_TO_INSTRUCTION[key] ?? LOCALE_TO_INSTRUCTION.en;
  const multi =
    typeof stats.siteCount === 'number' && stats.siteCount > 1
      ? `\nContext: this report aggregates ${stats.siteCount} establishments (group view). Mention lightly if relevant — no name list.`
      : '';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You write tight, premium email lines for reputation reports. One JSON object only: {"subject":"...","hook":"...","teaser":"..."}. No markdown. Formal, data-driven, curiosity — no spam tone.`,
      },
      {
        role: 'user',
        content: `Account / label: ${stats.establishmentName}
Rating: ${stats.averageRating.toFixed(1)}/5 — ${stats.totalReviews} reviews (period aggregate)
Strength: ${'strength' in summary ? summary.strength : '—'}
Opportunity: ${'opportunity' in summary ? summary.opportunity : '—'}${multi}

Write subject, hook, and teaser ${lang}:
- subject: short, compelling (max ~90 chars worth)
- hook: opening line
- teaser: 2–3 sentences that invite opening the PDF, without giving away everything`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const p = JSON.parse(content) as { subject?: string; hook?: string; teaser?: string };
  const fallbackSubject =
    key === 'fr' ? 'Votre rapport mensuel REPUTEXA' : 'Your REPUTEXA monthly report';
  return {
    subject: String(p.subject ?? fallbackSubject).slice(0, 120),
    hook: String(p.hook ?? '').slice(0, 200),
    teaser: String(p.teaser ?? '').slice(0, 400),
  };
}
