import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un expert en e-réputation. Génère une réponse professionnelle, empathique et constructive pour un avis client négatif.
Règles :
- Détecte la langue de l'avis et réponds dans la MÊME langue.
- Excuses sincères sans être excessif.
- Propose une solution ou une prochaine étape.
- Ton chaleureux et humain.
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
    return 'Merci pour votre retour. Nous sommes désolés de votre expérience et restons à votre disposition pour en discuter.';
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
    return content && content.length > 0
      ? content
      : 'Merci pour votre avis. Nous prenons en compte chaque retour pour améliorer notre service.';
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[whatsapp-alerts] generateSuggestedResponse error:', error);
    }
    return 'Merci pour votre retour. Nous sommes désolés et restons disponibles pour toute question.';
  }
}
