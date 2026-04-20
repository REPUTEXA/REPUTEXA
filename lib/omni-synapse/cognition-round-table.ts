import OpenAI from 'openai';
import { generateText } from '@/lib/ai-service';
import type {
  LoyaltyRoundResult,
  PsychologistRoundResult,
  RoundTableInput,
  RoundTableResult,
  SeoStrategistRoundResult,
} from './types';

const GPT4O_PSYCHOLOGIST = 'gpt-4o';
const DEFAULT_WEIGHTS = { psychologist: 0.38, strategist: 0.35, loyalty: 0.27 } as const;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * Expert Psychologue — GPT-4o : état émotionnel & urgence.
 */
export async function runPsychologistRound(
  input: RoundTableInput
): Promise<PsychologistRoundResult> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      emotionalUrgency: 0.5,
      emotionalSummary: 'OpenAI non configuré — priorité neutre.',
      dominantValence: 'mixed',
    };
  }

  const completion = await openai.chat.completions.create({
    model: GPT4O_PSYCHOLOGIST,
    temperature: 0.2,
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Tu es un psychologue clinicien digital expert en e-réputation B2C. ' +
          'Évalue l\'urgence émotionnelle et réputationnelle (0 à 1). ' +
          'Réponds UNIQUEMENT en JSON : ' +
          '{"emotionalUrgency": number, "emotionalSummary": string, "dominantValence": "negative"|"mixed"|"positive"}',
      },
      {
        role: 'user',
        content:
          `Contexte établissement : ${input.establishmentContext}\n\n` +
          `Interaction / avis :\n"""${input.interactionText.slice(0, 12000)}"""`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  try {
    const parsed = JSON.parse(raw) as {
      emotionalUrgency?: number;
      emotionalSummary?: string;
      dominantValence?: string;
    };
    const v = parsed.dominantValence;
    const valence: PsychologistRoundResult['dominantValence'] =
      v === 'negative' || v === 'positive' || v === 'mixed' ? v : 'mixed';
    return {
      emotionalUrgency: clamp01(Number(parsed.emotionalUrgency ?? 0.5)),
      emotionalSummary: String(parsed.emotionalSummary ?? '').slice(0, 500) || 'Analyse indisponible.',
      dominantValence: valence,
    };
  } catch {
    return {
      emotionalUrgency: 0.55,
      emotionalSummary: 'Parse JSON échoué.',
      dominantValence: 'mixed',
    };
  }
}

/**
 * Expert Stratège SEO — Claude 3.5 : mots-clés manquants fiche Google.
 */
export async function runSeoStrategistRound(
  input: RoundTableInput
): Promise<SeoStrategistRoundResult> {
  const kw = input.currentSeoKeywords.length
    ? input.currentSeoKeywords.join(', ')
    : '(aucun mot-clé enregistré)';

  const userBlock =
    `Établissement / contexte :\n${input.establishmentContext}\n\n` +
    `Mots-clés déjà suivis : ${kw}\n\n` +
    `Interaction client (pour tonalité locale) :\n"""${input.interactionText.slice(0, 6000)}"""`;

  const systemPrompt =
    'Tu es un stratège SEO local Google Business Profile. ' +
    'Propose les mots-clés MANQUANTS ou sous-exploités sur la fiche ce mois-ci (max 8). ' +
    'Évalue un seoGapScore 0-1 (1 = grande lacune). ' +
    'Réponds UNIQUEMENT en JSON : ' +
    '{"missingKeywords": string[], "seoGapScore": number, "rationale": string}';

  let text: string;
  try {
    text = await generateText({
      systemPrompt,
      userContent: userBlock,
      temperature: 0.3,
      maxTokens: 600,
    });
  } catch {
    return {
      missingKeywords: [],
      seoGapScore: 0.4,
      rationale: 'Stratège indisponible.',
    };
  }

  try {
    const parsed = JSON.parse(text.trim()) as {
      missingKeywords?: string[];
      seoGapScore?: number;
      rationale?: string;
    };
    const missing = Array.isArray(parsed.missingKeywords)
      ? parsed.missingKeywords.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
      : [];
    return {
      missingKeywords: missing,
      seoGapScore: clamp01(Number(parsed.seoGapScore ?? 0.4)),
      rationale: String(parsed.rationale ?? '').slice(0, 600),
    };
  } catch {
    return {
      missingKeywords: [],
      seoGapScore: 0.45,
      rationale: 'JSON stratège invalide.',
    };
  }
}

/**
 * Expert Fidélité — heuristique CRM (pas d’appel LLM : donnée structurée).
 */
export function runLoyaltyRound(visitCount: number): LoyaltyRoundResult {
  const n = Math.max(1, Math.floor(visitCount));
  let loyaltyPrioritySignal: number;
  let label: LoyaltyRoundResult['label'];
  if (n === 1) {
    loyaltyPrioritySignal = 0.82;
    label = 'first_visit';
  } else if (n >= 10) {
    loyaltyPrioritySignal = 0.88;
    label = 'champion';
  } else {
    loyaltyPrioritySignal = 0.62 + Math.min(0.15, n * 0.02);
    label = 'returning';
  }
  return {
    visitCount: n,
    loyaltyPrioritySignal: clamp01(loyaltyPrioritySignal),
    label,
  };
}

/**
 * Agrégation style « consensus bayésien » : 1 - ∏(1 - w_i * s_i).
 */
export function combinePriorityScore(
  psychologist: PsychologistRoundResult,
  strategist: SeoStrategistRoundResult,
  loyalty: LoyaltyRoundResult,
  weights = DEFAULT_WEIGHTS
): number {
  const s1 = clamp01(psychologist.emotionalUrgency);
  const s2 = clamp01(strategist.seoGapScore);
  const s3 = clamp01(loyalty.loyaltyPrioritySignal);
  const w1 = weights.psychologist;
  const w2 = weights.strategist;
  const w3 = weights.loyalty;
  const product =
    (1 - w1 * s1) *
    (1 - w2 * s2) *
    (1 - w3 * s3);
  return clamp01(1 - product);
}

/**
 * Table Ronde Virtuelle complète (3 experts → score de priorité).
 */
export async function runVirtualRoundTable(input: RoundTableInput): Promise<RoundTableResult> {
  const [psychologist, strategist] = await Promise.all([
    runPsychologistRound(input),
    runSeoStrategistRound(input),
  ]);
  const loyalty = runLoyaltyRound(input.visitCount);
  const priorityScore = combinePriorityScore(psychologist, strategist, loyalty);

  return {
    psychologist,
    strategist,
    loyalty,
    priorityScore,
    expertWeights: { ...DEFAULT_WEIGHTS },
  };
}
