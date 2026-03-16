import OpenAI from 'openai';
import { HUMAN_CHARTER_BASE, SMS_WHATSAPP_TONE, HUMAN_FALLBACKS } from '@/lib/ai/concierge-prompts';
import type { ReviewPlatform } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un expert en e-réputation et relation client luxe. Génère une réponse pour un avis client négatif, destinée au flux WhatsApp (alerte patron).
${HUMAN_CHARTER_BASE}
${SMS_WHATSAPP_TONE}
AVIS NÉGATIFS — DIPLOMATIE TOTALE :
- Ne jamais être sur la défensive.
- Technique du "Coussin" : valider l'émotion du client ("Je comprends votre déception concernant...") AVANT toute explication ou solution.
- Élégance : transformer le mécontentement en preuve de sérieux professionnel.
- Détecte la langue et réponds dans la MÊME langue.
- Phrases courtes, ton direct, vouvoiement impeccable.
Adapte la réponse selon la plateforme d'origine de l'avis (Google, Facebook, Trustpilot) :
- Google : mets l'accent sur le SEO local (mots-clés liés au type d'établissement et à la ville) tout en restant naturel.
- Facebook : ton chaleureux, conversationnel, possibilité d'émojis adaptés au contexte (sans en abuser).
- Trustpilot : ton très professionnel, rassurant, orienté preuve sociale et sérieux de la marque.
Renvoie UNIQUEMENT le texte brut de la réponse. Pas de guillemets, pas de "Voici la réponse :".`;

export interface GenerateAiResponseInput {
  comment: string;
  rating: number;
  establishmentName?: string;
  platform?: ReviewPlatform;
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
      temperature: 0.8,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Plateforme: ${input.platform ?? 'google'} | Avis: "${input.comment}" | Note: ${input.rating}/5 | Établissement: ${input.establishmentName ?? 'client'}. Génère une réponse.`,
        },
      ],
    });

    let content = completion.choices[0]?.message?.content?.trim() ?? '';
    content = content.replace(/^["']|["']$/g, '').replace(/^Voici la réponse\s*:?\s*/i, '');
    return content.length > 0 ? content : HUMAN_FALLBACKS.negativeSorry;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[whatsapp-alerts] generateSuggestedResponse error:', error);
    }
    return HUMAN_FALLBACKS.negativeSorry;
  }
}
