/**
 * Extraction d'apprentissage — Architecture Génesis v2
 *
 * Claude 3.5 Sonnet analyse la transcription d'un ticket fermé et produit :
 *   1. root_cause / effective_solution / prevention  (mémoire positive — ai_learning_knowledge)
 *   2. gold_standard_score  (1–10 : ≥ 8 = Standard d'Or)
 *   3. tool_used            (outil décisif, si applicable)
 *   4. error_pattern / root_mistake / correct_approach (mémoire négative — ai_learning_feedback)
 */

import Anthropic from '@anthropic-ai/sdk';

import { ANTHROPIC_DEFAULT_SONNET } from '@/lib/ai/anthropic-model-defaults';

const MODEL =
  process.env.ANTHROPIC_SUPPORT_LEARNING_MODEL?.trim() || ANTHROPIC_DEFAULT_SONNET;

type Msg = { sender: string; content: string };

function getAnthropic(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) throw new Error('ANTHROPIC_API_KEY manquant');
  return new Anthropic({ apiKey: key });
}

// ── Types exportés ────────────────────────────────────────────────────────────

export type ExtractedLearning = {
  /** Mémoire positive */
  root_cause: string;
  effective_solution: string;
  prevention: string;
  /** Gold Standard */
  gold_standard_score: number;  // 1–10 (≥ 8 = Standard d'Or)
  tool_used: string | null;
  /** Mémoire négative (null si aucune erreur agent détectée) */
  feedback: {
    error_pattern: string;
    root_mistake: string;
    correct_approach: string;
  } | null;
};

// ── Extraction complète ───────────────────────────────────────────────────────

export async function extractLearningFromTranscript(messages: Msg[]): Promise<ExtractedLearning> {
  const transcript = messages
    .map((m) => `${m.sender === 'user' ? 'Client' : 'Conseiller IA'} : ${m.content}`)
    .join('\n\n');

  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1600,
    temperature: 0.15,
    messages: [
      {
        role: 'user',
        content: `Tu es un ingénieur senior qui analyse un ticket support REPUTEXA fermé.
Rédige en français, style factuel et technique (pas de vouvoiement dans le JSON).
Ne jamais inclure de données personnelles (noms, emails, téléphones) : généralise.

INSTRUCTIONS :
Retourne UNIQUEMENT un JSON valide, sans markdown, avec les clés EXACTES suivantes :

{
  "root_cause": string,                 // cause racine technique (générique)
  "effective_solution": string,         // solution appliquée (générique)
  "prevention": string,                 // comment éviter à l'avenir
  "gold_standard_score": number,        // score 1-10 : qualité de résolution
                                        // 9-10 = résolution rapide, propre, outil décisif
                                        // 7-8  = bonne résolution, quelques détours
                                        // 4-6  = résolution partielle ou lente
                                        // 1-3  = échec ou escalade manuelle
  "tool_used": string | null,           // outil agent décisif si applicable (ex: "validate_phone_format")
  "has_agent_error": boolean,           // true si l'agent a commis une erreur corrigée en cours de conversation
  "error_pattern": string | null,       // si has_agent_error: schéma de l'erreur (générique)
  "root_mistake": string | null,        // si has_agent_error: cause de l'erreur agent
  "correct_approach": string | null     // si has_agent_error: bonne approche retenue
}

Transcription :
---
${transcript.slice(0, 48000)}
---`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === 'text' && 'text' in b);
  const raw   = block && 'text' in block ? block.text : '';
  const match = raw.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : raw;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return buildFallback(transcript);
  }

  const score = typeof parsed.gold_standard_score === 'number'
    ? Math.max(1, Math.min(10, Math.round(parsed.gold_standard_score)))
    : 5;

  const hasAgentError = parsed.has_agent_error === true;
  const errorPattern  = hasAgentError && parsed.error_pattern  ? String(parsed.error_pattern)  : null;
  const rootMistake   = hasAgentError && parsed.root_mistake   ? String(parsed.root_mistake)   : null;
  const correctAppr   = hasAgentError && parsed.correct_approach ? String(parsed.correct_approach) : null;

  return {
    root_cause:         String(parsed.root_cause        ?? '').trim() || 'Non précisé',
    effective_solution: String(parsed.effective_solution ?? '').trim() || 'Non précisé',
    prevention:         String(parsed.prevention         ?? '').trim() || 'Non précisé',
    gold_standard_score: score,
    tool_used: parsed.tool_used ? String(parsed.tool_used) : null,
    feedback: (errorPattern && rootMistake && correctAppr)
      ? { error_pattern: errorPattern, root_mistake: rootMistake, correct_approach: correctAppr }
      : null,
  };
}

// ── Fallback si JSON invalide ─────────────────────────────────────────────────

function buildFallback(transcript: string): ExtractedLearning {
  return {
    root_cause:          "Impossible d'analyser automatiquement le ticket.",
    effective_solution:  transcript.slice(0, 500),
    prevention:          'Vérifier les logs et documenter le correctif manuellement.',
    gold_standard_score: 1,
    tool_used:           null,
    feedback:            null,
  };
}
