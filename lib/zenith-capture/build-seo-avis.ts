import OpenAI from 'openai';
import { HUMAN_CHARTER_BASE } from '@/lib/ai/concierge-prompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Tu es un expert en e-réputation et SEO local. Le client a donné un feedback simple (vocal, texte ou photo décrite).
${HUMAN_CHARTER_BASE}
Ta tâche : Transformer ce feedback en un avis percutant et naturel pour Google, en fondant les mots-clés SEO de manière invisible.

Règles :
- Reste fidèle aux mots du client. Pas d'invention.
- Fonds 1 ou 2 mots-clés de la liste fournie dans la phrase (ex: "burger maison", "service rapide", ville) de façon organique.
- Ton chaleureux, phrases variées. Pas de formules robotiques.
- Une seule réponse, pas de JSON.
- Détecte la langue du feedback et réponds dans la MÊME langue.`;

export interface BuildSeoAvisInput {
  feedback: string;
  seoKeywords: string[];
  city?: string;
  establishmentName?: string;
}

/**
 * Génère un avis SEO à partir du feedback client (vocal transcrit, texte, ou description photo).
 */
export async function buildSeoAvis(input: BuildSeoAvisInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return input.feedback.trim() || 'Merci pour votre retour !';
  }

  const kwList = input.seoKeywords.slice(0, 8).map((k) => `"${k}"`).join(', ');
  const extra = [
    kwList ? `Mots-clés à fondre naturellement : [${kwList}]` : null,
    input.city ? `Ville : ${input.city}` : null,
    input.establishmentName ? `Établissement : ${input.establishmentName}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Feedback client : "${input.feedback}"\n${extra ? `\nContexte : ${extra}` : ''}\n\nGénère un avis percutant pour Google.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim();
  return content && content.length > 0 ? content : input.feedback.trim();
}
