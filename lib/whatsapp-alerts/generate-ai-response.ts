import OpenAI from 'openai';
import { HUMAN_CHARTER_BASE, SMS_WHATSAPP_TONE, HUMAN_FALLBACKS } from '@/lib/ai/concierge-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un expert en e-réputation. Génère une réponse pour un avis client négatif, destinée au flux WhatsApp (alerte patron).
${HUMAN_CHARTER_BASE}
${SMS_WHATSAPP_TONE}
Règles :
- Détecte la langue de l'avis et réponds dans la MÊME langue.
- Excuses sincères sans être excessif. Propose une solution ou une prochaine étape.
- Phrases courtes, ton direct, quelques points d'exclamation naturels.
Réponds UNIQUEMENT avec le texte de la réponse, rien d'autre.`;

export interface GenerateAiResponseInput {
  comment: string;
  rating: number;
  establishmentName?: string;
}

/**
 * Génère une réponse IA suggérée pour un avis négatif.
 * Utilisé avant l'envoi de l'alerte WhatsApp.
 */
export async function generateSuggestedResponse(
  input: GenerateAiResponseInput
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return HUMAN_FALLBACKS.negativeSorry;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Avis: "${input.comment}" | Note: ${input.rating}/5 | Établissement: ${input.establishmentName ?? 'client'}. Génère une réponse.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : HUMAN_FALLBACKS.negativeSorry;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[whatsapp-alerts] generateSuggestedResponse error:', error);
    }
    return HUMAN_FALLBACKS.negativeSorry;
  }
}
