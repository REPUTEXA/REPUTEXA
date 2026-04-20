/**
 * Contrôle qualité systématique des réponses avis (batterie de tests "anti-IA").
 * OpenAI (JSON mode) en priorité ; Anthropic via generateText si OpenAI indisponible.
 */
import OpenAI from 'openai';
import { scrubAiTypography } from './human-keyboard-output';
import { generateText } from '@/lib/ai-service';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const GATE_SYSTEM = `Tu es un contrôleur qualité senior pour réponses d'établissements aux avis en ligne.
Tu valides un BROUILLON par rapport au texte d'AVIS CLIENT.

BATTERIE DE TESTS (pass=true uniquement si TOUS sont OK) :

T1 — PHRASES "ROBOT" INTERDITES (aucune, même détournée) :
"votre satisfaction est notre priorité", "expérience culinaire", "à votre écoute",
"Merci de votre confiance", "N'hésitez pas à", "Votre retour est précieux",
"désagrément", "Nous prenons note", "Nous restons à votre disposition",
"Merci pour votre commentaire" comme phrase d'accroche vide,
"Nous avons bien reçu votre avis" en ouverture.

T2 — REGISTRE : en français, vouvoiement strict au client (vous), pas de tutoiement.
Dans les autres langues : registre formel / polite attendu pour un commerce équivalent au vouvoiement.

T3 — MIROIR : au moins 2 expressions ou concepts importants tirés de l'avis doivent apparaître dans la réponse
(mots ou reformulation très proche — preuve que l'avis a été lu).

T4 — COHÉRENCE : pas d'invention majeure (plat, incident, promesse) absente de l'avis.

Si un test échoue : pass=false et "revised" = réponse ENTIÈRE corrigée, même longueur approximative,
même langue que le brouillon, inchangée la structure (paragraphes) si possible.

Réponds UNIQUEMENT en JSON : {"pass":boolean,"failed":string[],"revised":string|null}`;

export type HumanGateInput = {
  draft: string;
  reviewComment: string;
  establishmentName?: string;
};

function parseGateJson(raw: string): { pass?: boolean; revised?: string | null } {
  try {
    return JSON.parse(raw) as { pass?: boolean; revised?: string | null };
  } catch {
    return {};
  }
}

async function runGateWithOpenAI(userContent: string): Promise<{ pass?: boolean; revised?: string | null }> {
  if (!openai) return {};
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: GATE_SYSTEM },
      { role: 'user', content: userContent },
    ],
  });
  return parseGateJson(completion.choices[0]?.message?.content ?? '{}');
}

async function runGateWithClaude(userContent: string): Promise<{ pass?: boolean; revised?: string | null }> {
  const raw = await generateText({
    systemPrompt: `${GATE_SYSTEM}\nRéponds uniquement avec un objet JSON valide, sans markdown.`,
    userContent,
    temperature: 0.2,
    maxTokens: 1200,
  });
  return parseGateJson(raw?.trim() ?? '{}');
}

export async function humanScreenReviewReply(input: HumanGateInput): Promise<string> {
  const draft = String(input.draft ?? '').trim();
  if (!draft) {
    return scrubAiTypography(draft);
  }

  const userContent = `Établissement: ${input.establishmentName ?? '—'}
AVIS CLIENT :
"""${input.reviewComment.slice(0, 4000)}"""

BROUILLON RÉPONSE :
"""${draft.slice(0, 4000)}"""`;

  try {
    let parsed: { pass?: boolean; revised?: string | null } = {};
    if (openai) {
      try {
        parsed = await runGateWithOpenAI(userContent);
      } catch {
        parsed = await runGateWithClaude(userContent);
      }
    } else {
      parsed = await runGateWithClaude(userContent);
    }

    if (parsed.pass === true) {
      return scrubAiTypography(draft);
    }
    const revised = typeof parsed.revised === 'string' ? parsed.revised.trim() : '';
    if (revised.length > 0) {
      return scrubAiTypography(revised);
    }
  } catch {
    // fallthrough
  }

  return scrubAiTypography(draft);
}
