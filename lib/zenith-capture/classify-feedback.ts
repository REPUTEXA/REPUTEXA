import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CLASSIFICATIONS = [
  'service',
  'qualite_nourriture',
  'ambiance',
  'rapport_qualite_prix',
  'attente',
  'hygiene',
  'autre',
] as const;

export type FeedbackClassification = (typeof CLASSIFICATIONS)[number];

const SYSTEM_PROMPT = `Tu classifies les suggestions d'amélioration des clients pour un restaurant.
Classes dans une seule catégorie parmi : service, qualite_nourriture, ambiance, rapport_qualite_prix, attente, hygiene, autre.
Réponds UNIQUEMENT avec le libellé exact de la catégorie (ex: service), rien d'autre.`;

/**
 * Classifie une suggestion d'amélioration (pour le dashboard Growth).
 */
export async function classifyFeedback(text: string): Promise<FeedbackClassification> {
  if (!process.env.OPENAI_API_KEY || !text?.trim()) return 'autre';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `"${text.trim()}"` },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim()?.toLowerCase();
    if (raw && CLASSIFICATIONS.includes(raw as FeedbackClassification)) {
      return raw as FeedbackClassification;
    }
  } catch {
    // ignore
  }
  return 'autre';
}
