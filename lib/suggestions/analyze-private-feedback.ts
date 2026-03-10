import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ThemeSentiment = 'Positif' | 'Neutre' | 'Constructif';

export interface AnalyzedTheme {
  theme: string;
  title: string;
  count: number;
  sentiment: ThemeSentiment;
  feedbackIds: string[];
}

const SYSTEM_PROMPT = `Tu es un analyste de retours clients pour un restaurant.
Tu reçois une liste de suggestions clients (feedback_text) et tu dois :
1. Regrouper les suggestions similaires sous des thématiques (ex: "Rapidité du service", "Qualité des desserts", "Ambiance sonore")
2. Pour chaque regroupement, générer un titre clair et court (max 8 mots)
3. Classer le sentiment : Positif (éloge ou suggestion d'amélioration bienveillante), Neutre (observation factuelle), Constructif (critique ou demande d'amélioration)
Réponds UNIQUEMENT en JSON valide :
{
  "themes": [
    {
      "theme": "identifiant_technique_court",
      "title": "Titre lisible pour le patron",
      "count": 5,
      "sentiment": "Positif" | "Neutre" | "Constructif",
      "feedbackIds": ["uuid1", "uuid2"]
    }
  ],
  "priorityAdvice": "Une seule phrase d'action prioritaire (ex: '15% de vos clients suggèrent d'ajouter une option végétarienne au menu du midi') ou null si aucune donnée"
}`;

export interface AnalyzeResult {
  themes: AnalyzedTheme[];
  priorityAdvice: string | null;
}

/**
 * Analyse et regroupe les retours private_feedback avec l'IA.
 */
export async function analyzePrivateFeedback(
  feedbacks: Array<{ id: string; feedback_text: string; classification?: string | null }>
): Promise<AnalyzeResult> {
  if (!process.env.OPENAI_API_KEY || feedbacks.length === 0) {
    return { themes: [], priorityAdvice: null };
  }

  const list = feedbacks
    .map((f) => `[${f.id}] "${(f.feedback_text || '').trim().slice(0, 300)}"`)
    .join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyse et regroupe ces retours clients. Les UUID sont entre crochets pour identifier chaque feedback.\n\n${list}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return { themes: [], priorityAdvice: null };

    const parsed = JSON.parse(raw) as {
      themes?: Array<{
        theme: string;
        title: string;
        count?: number;
        sentiment?: string;
        feedbackIds?: string[];
      }>;
      priorityAdvice?: string | null;
    };

    const validIds = new Set(feedbacks.map((f) => f.id));
    const themes: AnalyzedTheme[] = (parsed.themes ?? [])
      .filter((t) => t.title && t.feedbackIds?.length)
      .map((t) => ({
        theme: t.theme || 'autre',
        title: t.title,
        count: t.count ?? t.feedbackIds?.length ?? 0,
        sentiment: ['Positif', 'Neutre', 'Constructif'].includes(t.sentiment ?? '')
          ? (t.sentiment as ThemeSentiment)
          : 'Neutre',
        feedbackIds: (t.feedbackIds ?? []).filter((id) => validIds.has(id)),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      themes,
      priorityAdvice: parsed.priorityAdvice ?? null,
    };
  } catch {
    return { themes: [], priorityAdvice: null };
  }
}
