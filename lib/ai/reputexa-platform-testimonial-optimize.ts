import OpenAI from 'openai';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';

const MODEL = 'gpt-4o-mini';

/** Langues UI du site (codes courts) → consigne de sortie */
const LOCALE_INSTRUCTION: Record<string, string> = {
  fr: 'French',
  en: 'English (US)',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese (Portugal or Brazil-neutral professional tone)',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
};

function outputLanguageHint(locale: string): string {
  const key = locale.trim().toLowerCase().slice(0, 5);
  return LOCALE_INSTRUCTION[key] ?? LOCALE_INSTRUCTION.en ?? 'English (US)';
}

/**
 * Réécrit un brouillon d’avis Google pour REPUTEXA (produit SaaS réputation / IA).
 */
export async function optimizeReputexaPlatformTestimonial(input: {
  draft: string;
  uiLocale: string;
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY missing');
  }
  const openai = new OpenAI({ apiKey: key });
  const lang = outputLanguageHint(input.uiLocale);

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.65,
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `You help merchants write a public Google review for the SaaS product REPUTEXA (AI reputation management, Google Business, review responses, WhatsApp alerts).
Rewrite the user's draft into ONE polished review paragraph that sounds human and trustworthy.
Output language: ${lang} only.
Include subtle SEO terms where natural (e.g. online reputation, Google reviews, AI responses) — no hashtag, no bullet list, no quotes around the whole text, no greeting, no "I give 5 stars" filler. Max 550 characters.`,
      },
      {
        role: 'user',
        content: input.draft.trim(),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';
  return scrubAiTypography(raw);
}
