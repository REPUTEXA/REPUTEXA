import OpenAI from 'openai';
import { HUMAN_CHARTER_BASE } from '@/lib/ai/concierge-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un expert en e-réputation. Un patron a reçu une première suggestion de réponse à un avis négatif.
Il t'envoie une instruction de modification (texte ou vocal retranscrit).

Tâche : Fusionne l'avis original + la première réponse + l'instruction du patron pour générer une V2 améliorée.
${HUMAN_CHARTER_BASE}
Règles :
- Respecte EXACTEMENT l'instruction du patron (ton, contenu, longueur, etc.).
- Garde la même langue que l'avis et la première réponse.
- Reste humain, organique, jamais robotique. Bannis les formules IA.
Réponds UNIQUEMENT avec le texte de la nouvelle réponse, rien d'autre.`;

export interface GenerateModifiedResponseInput {
  originalReview: string;
  firstResponse: string;
  patronInstruction: string;
}

/**
 * Génère une V2 de la réponse en fusionnant l'avis, la V1 et l'instruction du patron.
 */
export async function generateModifiedResponse(
  input: GenerateModifiedResponseInput
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return input.firstResponse;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Avis client : "${input.originalReview}"

Première réponse suggérée : "${input.firstResponse}"

Instruction du patron (modification souhaitée) : "${input.patronInstruction}"

Génère la V2 de la réponse.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : input.firstResponse;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[whatsapp-alerts] generateModifiedResponse error:', error);
    }
    return input.firstResponse;
  }
}
