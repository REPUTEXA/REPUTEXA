/**
 * REPUTEXA Shield — Moteur de détection de toxicité
 * Partagé entre l'ingestion manuelle, les webhooks et le cron de sweep.
 *
 * Dual-engine : Anthropic Claude (principal) → fallback GPT-4o-mini (OpenAI).
 * Server-side only.
 */

import { generateText } from '@/lib/ai-service';

export type ToxicCategory =
  | 'none'
  | 'hate_or_threat'
  | 'doxxing'
  | 'spam_or_ad'
  | 'conflict_of_interest';

export interface ToxicityAnalysis {
  isToxic: boolean;
  category: ToxicCategory;
  reason: string | null;
  complaintText: string | null;
  legalArgumentation: string | null;
}

const SYSTEM_PROMPT = `Tu es un modérateur expert en e-réputation pour établissements français. Ta mission : analyser un avis client et déterminer s'il est TOXIQUE selon 4 catégories précises.

CATÉGORIES DE TOXICITÉ :
1. hate_or_threat — Insultes, propos discriminatoires, menaces explicites ou voilées, harcèlement
2. doxxing — Numéros de téléphone privés, adresses personnelles, noms complets de tiers non publics
3. spam_or_ad — Promotion d'un concurrent, lien commercial, message automatisé, faux avis coordonné
4. conflict_of_interest — Chantage explicite, extorsion liée à un avantage, concurrent identifiable

SI TOXIQUE → rédige une plainte formelle destinée aux modérateurs de la plateforme :
- Ton juridique, froid et percutant
- Cite les conditions d'utilisation violées
- ~200 mots, prêt à copier-coller dans un formulaire de signalement officiel

FORMAT JSON STRICT (aucun texte avant ou après) :
{
  "category": "none|hate_or_threat|doxxing|spam_or_ad|conflict_of_interest",
  "full_complaint_text": "<texte complet de la plainte ou vide si non toxique>",
  "legal_argumentation": "<argumentation juridique concise ou vide si non toxique>"
}

NE MARQUE TOXIQUE que si le motif est clair et incontestable. En cas de doute, catégorie = "none".`;

const CATEGORY_LABELS: Record<ToxicCategory, string> = {
  none: '',
  hate_or_threat: 'Haine / menace',
  doxxing: 'Doxxing (données personnelles)',
  spam_or_ad: 'Spam / publicité',
  conflict_of_interest: "Conflit d'intérêt",
};

/**
 * Analyse un avis et retourne le diagnostic de toxicité.
 * Ne lève jamais d'exception — retourne isToxic: false en cas d'erreur.
 */
export async function detectToxicity(
  comment: string,
  platformLabel: string
): Promise<ToxicityAnalysis> {
  const safe: ToxicityAnalysis = {
    isToxic: false,
    category: 'none',
    reason: null,
    complaintText: null,
    legalArgumentation: null,
  };

  const trimmed = comment?.trim();
  if (!trimmed) return safe;

  try {
    const userContent =
      `Plateforme : ${platformLabel}.\n\n` +
      `Analyse cet avis client :\n"""\n${trimmed}\n"""`;

    const raw = await generateText({
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      temperature: 0,
      maxTokens: 1200,
    });

    // Extract JSON even if the model wraps it in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return safe;

    const parsed = JSON.parse(jsonMatch[0]) as {
      category?: string;
      full_complaint_text?: string;
      legal_argumentation?: string;
    };

    const category = (parsed.category ?? 'none') as ToxicCategory;
    if (!category || category === 'none') return safe;

    return {
      isToxic: true,
      category,
      reason: CATEGORY_LABELS[category] ?? 'Contenu toxique',
      complaintText: parsed.full_complaint_text?.trim() || null,
      legalArgumentation: parsed.legal_argumentation?.trim() || null,
    };
  } catch (err) {
    console.error('[shield/detect-toxicity] Analysis failed, defaulting to safe:', err);
    return safe;
  }
}
