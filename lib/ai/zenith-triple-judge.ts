/**
 * Workflow Triple Rédaction + Juge — Pulse (sans SEO forcé) et Zenith (SEO + concierge).
 * 3 variantes (empathie, storytelling, expertise) puis juge sélectionne la meilleure.
 * Utilise le moteur central ai-service (Claude principal, OpenAI fallback).
 */
import { generateText } from '@/lib/ai-service';
import {
  HUMAN_CHARTER_BASE,
  ZENITH_CONCIERGE_ADDON,
  buildZenithSeoInstruction,
  HUMAN_FALLBACKS,
} from './concierge-prompts';
import { scrubAiTypography } from './human-keyboard-output';

export type TripleJudgeTier = 'pulse' | 'zenith';

const PULSE_TRIPLE_HEADER = `
PLAN PULSE — Triple rédaction haute précision :
Trois versions distinctes, puis sélection de la meilleure. Même exigence "humain irréprochable".
Ne force aucun mot-clé SEO : fluidité et sincérité avant tout.
`;

const ZENITH_TRIPLE_FOCUS = `
TRIPLE RÉDACTION - Génère exactement 3 variantes distinctes :

1. VARIANTE EMPATHIE : Focus chaleur humaine, reconnaissance émotionnelle, connexion avec le client. Rebondis sur le ressenti exprimé.
2. VARIANTE STORYTELLING : Focus sur l'histoire de l'établissement, l'origine des produits, l'ambiance, les petits détails qui font l'âme du lieu.
3. VARIANTE EXPERTISE : Focus sur le produit/technique (plats, recettes, sélection, savoir-faire). Met en valeur le professionnalisme sans être froid.

Chaque variante doit rester 100 % humaine et respecter la charte anti-IA.
Réponds UNIQUEMENT en JSON : {"options": ["Var1", "Var2", "Var3"], "detectedLanguage": "fr"}
`;

function buildJudgeSystem(params: {
  aiTon?: string;
  aiLength?: string;
  aiCustomInstructions?: string;
}): string {
  const tonDesc =
    params.aiTon === 'luxury'
      ? 'Luxueux : vocabulaire noble, formules raffinées'
      : params.aiTon === 'warm'
        ? 'Chaleureux : empathie et connexion'
        : params.aiTon === 'casual'
          ? 'Décontracté : ton léger mais toujours en vouvoiement'
          : params.aiTon === 'humorous'
            ? 'Humoristique : touche légère et souriante'
            : 'Professionnel : courtois et sérieux';
  const lengthRule =
    params.aiLength === 'concise'
      ? 'Concis : maximum 2 phrases, aucune phrase en trop'
      : params.aiLength === 'detailed'
        ? 'Détaillé : 3 à 5 phrases pour le SEO'
        : 'Équilibré : 2 à 4 phrases';
  const hasCustom = (params.aiCustomInstructions ?? '').trim().length > 0;

  return `Tu es un Juge qualité pour réponses e-réputation. On te donne 3 variantes (empathie, storytelling, expertise).
Tu dois ÉLIMINER toute variante qui viole un critère éliminatoire. Parmi celles qui restent, choisis la meilleure.

CRITÈRES ÉLIMINATOIRES (si une variante échoue, elle est éliminée) :
1. CONFORMITÉ AU TON : ${tonDesc}. Si le ton demandé est "Luxueux" et le vocabulaire est trop ordinaire → éliminé.
2. RESPECT DE LA LONGUEUR : ${lengthRule}. Si "Concis" demandé et la variante dépasse 2 phrases → éliminé.
3. VOUVOIEMENT STRICT : Si un "tu", "ton", "ta", "te" (tutoiement) est détecté → éliminé immédiatement.
4. INCLUSION DES CONSIGNES : ${
    hasCustom
      ? `Les instructions spécifiques du restaurateur doivent être présentes ou reflétées. Si absentes → éliminé.`
      : 'Pas de consignes spécifiques à respecter.'
  }
5. MIROIR CLIENT : la variante doit réemployer au moins deux formulations ou idées précises tirées du texte d'avis (sinon éliminée).
6. OUVERTURES DISTINCTES : les trois variantes ne doivent PAS commencer par la même structure (interdit que les trois ouvrent par un remerciement formel identique). Sinon élimine la moins originale.

Si plusieurs variantes passent tous les critères : choisis la plus humaine et fluide.

Réponds UNIQUEMENT en JSON : {"winner": 1|2|3, "reason": "raison courte"}
`;
}

function cleanOutput(text: string): string {
  const stripped = text
    .replace(/^["']|["']$/g, '')
    .replace(/^Voici la réponse\s*:?\s*/i, '')
    .replace(/\s*\[.*?\]\s*/g, '') // balises [ ... ]
    .replace(/<[^>]+>/g, '') // balises HTML
    .trim();
  return scrubAiTypography(stripped);
}

export type TripleJudgeContext = {
  reviewComment: string;
  reviewerName: string;
  rating: number;
  establishmentName: string;
  businessContext: string;
  seoKeywords: string[];
  styleInstruction: string;
  aiTon?: string;
  aiLength?: string;
  aiCustomInstructions?: string;
};

export async function runTripleJudge(context: TripleJudgeContext, tier: TripleJudgeTier): Promise<string> {
  const { reviewComment, reviewerName, rating } = context;
  const seoBlock =
    tier === 'zenith'
      ? buildZenithSeoInstruction(
          context.establishmentName,
          context.businessContext?.trim() || context.establishmentName,
          context.seoKeywords
        )
      : '';

  const tierHeader = tier === 'zenith' ? ZENITH_CONCIERGE_ADDON + '\n' : PULSE_TRIPLE_HEADER + '\n';

  const systemPrompt =
    `Tu es un expert en e-réputation pour établissements haut de gamme.\n` +
    HUMAN_CHARTER_BASE +
    '\n\n' +
    context.styleInstruction +
    '\n\n' +
    tierHeader +
    ZENITH_TRIPLE_FOCUS +
    seoBlock;

  const userContent = `Avis: "${reviewComment}" | Client: ${reviewerName} | Note: ${rating}/5 | Établissement: ${context.establishmentName}.
Génère 3 variantes en JSON. Chaque option = texte brut uniquement. Réponds UNIQUEMENT en JSON valide.`;

  const raw = await generateText({
    systemPrompt: systemPrompt + '\n\nRéponds UNIQUEMENT en JSON : {"options": ["Var1","Var2","Var3"], "detectedLanguage": "fr"}',
    userContent,
    temperature: 0.8,
  });
  const parsedRaw = raw?.trim() ?? '{}';
  let parsed: { options?: string[]; detectedLanguage?: string } = {};
  try {
    parsed = JSON.parse(parsedRaw);
  } catch {
    parsed = {};
  }
  const options = (parsed.options ?? []).slice(0, 3).map((o) => cleanOutput(String(o ?? '')));

  if (options.length < 3) {
    const fallbacks = [HUMAN_FALLBACKS.genericThanks, HUMAN_FALLBACKS.positiveShort, 'À très vite !'];
    while (options.length < 3) options.push(fallbacks[options.length]);
  }

  const judgeSystem = buildJudgeSystem({
    aiTon: context.aiTon,
    aiLength: context.aiLength,
    aiCustomInstructions: context.aiCustomInstructions,
  });

  const judgeUser = `Variante 1 (empathie): ${options[0]}\n\nVariante 2 (storytelling): ${options[1]}\n\nVariante 3 (expertise): ${options[2]}\n\nQuelle variante choisir (1, 2 ou 3) ? Réponds en JSON.`;

  const judgeRaw = await generateText({
    systemPrompt: judgeSystem,
    userContent: judgeUser,
    temperature: 0.3,
  });
  let judgeParsed: { winner?: number; reason?: string } = {};
  try {
    judgeParsed = JSON.parse(judgeRaw);
  } catch {
    judgeParsed = {};
  }
  const winnerIndex = Math.min(Math.max(1, Math.floor(Number(judgeParsed.winner) || 1)), 3) - 1;
  return cleanOutput(options[winnerIndex] ?? options[0] ?? HUMAN_FALLBACKS.positiveShort);
}

/** @deprecated préférez runTripleJudge(ctx, 'zenith') */
export async function runZenithTripleJudge(context: TripleJudgeContext): Promise<string> {
  return runTripleJudge(context, 'zenith');
}
