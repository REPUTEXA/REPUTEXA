/**
 * Moteur central IA Reputexa — Dual-Engine (Anthropic + OpenAI)
 * Server-side only. Toutes les clés API via process.env.
 *
 * - Moteur principal : Claude 3.5 Sonnet (Anthropic) — rédaction luxe
 * - Moteur de secours & tâches annexes : GPT-4o mini (OpenAI)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { HUMAN_FALLBACKS } from './ai/concierge-prompts';
import { scrubAiTypography } from './ai/human-keyboard-output';

import { ANTHROPIC_DEFAULT_SONNET } from '@/lib/ai/anthropic-model-defaults';
import {
  defaultEstablishmentNameForReviewReply,
  reviewReplySignatureInstruction,
} from '@/lib/ai/language-rule-for-locale';

const ANTHROPIC_MODEL = ANTHROPIC_DEFAULT_SONNET;
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';

function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) return null;
  return new Anthropic({ apiKey: key });
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

export type GenerateReviewParams = {
  /** Avis client à répondre */
  avis: string;
  /** Nom du reviewer (optionnel) */
  reviewerName?: string;
  /** Note /5 (optionnel) */
  rating?: number;
  /** Nom de l'établissement pour la signature */
  establishmentName: string;
  /** Téléphone de l'établissement (pour le bloc contact avis négatif) */
  phone?: string;
  /** Email de l'établissement (pour le bloc contact avis négatif) */
  email?: string;
  /** Ton : professional | warm | casual | luxury | humorous */
  ton?: string;
  /** Longueur : concise | balanced | detailed */
  longueur?: string;
  /** Instructions personnalisées du client */
  instructions?: string;
  /** Langue cible (ex: fr) ou 'auto' pour détecter */
  language?: string;
  /** Règle langue (Vision = établissement, Pulse/Zenith = même langue que l'avis) */
  languageRule?: string;
};

function buildMasterPrompt(params: GenerateReviewParams): string {
  const ton = params.ton || 'professional';
  const longueur = params.longueur || 'balanced';
  const instructions = params.instructions || '';
  const rawLang = (params.language || 'fr').trim().toLowerCase();
  const lang = rawLang === 'auto' ? 'auto' : rawLang.slice(0, 5) || 'fr';
  const nom = params.establishmentName.trim() || defaultEstablishmentNameForReviewReply(lang);
  const signatureInstruction = reviewReplySignatureInstruction(lang, params.establishmentName);

  const tonDesc =
    ton === 'luxury'
      ? 'Luxueux - vocabulaire noble, chaque mot est choisi, formules raffinées sans être pompeuses'
      : ton === 'warm'
        ? 'Chaleureux - empathie directe et sincère, on sent que tu tiens vraiment à ce client'
        : ton === 'casual'
          ? 'Décontracté - direct et accessible, mais toujours en vouvoiement strict'
          : ton === 'humorous'
            ? 'Touche légère et souriante, une phrase qui fait sourire sans être déplacée'
            : 'Professionnel - direct, bienveillant, sans fioritures ni jargon corporate';

  const lengthDesc =
    longueur === 'concise'
      ? '1 à 2 phrases maximum. Chaque mot doit peser. Rien de superflu.'
      : longueur === 'detailed'
        ? '3 à 5 phrases. Couvre chaque point soulevé dans l\'avis, point par point.'
        : '2 à 3 phrases. Équilibre entre clarté et personnalisation.';

  const isNegative = typeof params.rating === 'number' && params.rating < 3;
  const hasPhone = !!params.phone?.trim();
  const hasEmail = !!params.email?.trim();
  const hasContact = isNegative && (hasPhone || hasEmail);

  const contactLine = hasContact
    ? [
        hasPhone ? `au ${params.phone!.trim()}` : null,
        hasEmail ? `par email à ${params.email!.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' ou ')
    : '';

  const negativeBlock = hasContact
    ? `
━━━ AVIS NÉGATIF (note strictement inférieure à 3/5) - BLOC CONTACT OBLIGATOIRE ━━━
Après ta réponse principale, ajoute ce paragraphe de réconciliation, séparé par une ligne vide :
"Nous aimerions échanger avec vous pour comprendre ce qu'il s'est passé. N'hésitez pas à nous contacter directement ${contactLine}."
Ce bloc est NON NÉGOCIABLE. Il ne peut pas être omis, résumé ou modifié.`
    : '';

  return `
Tu es le patron (ou la patronne) de "${nom}". Tu réponds en personne à cet avis, comme si tu tapais sur ton téléphone entre deux services. Pas de filtre corporate. Juste toi, authentique.

━━━ RÈGLE 1 : EFFET MIROIR (obligatoire) ━━━
Identifie 2 ou 3 mots-clés ou concepts EXACTS cités dans l'avis (ex : "terrasse ombragée", "service lent", "dessert au chocolat").
Réutilise ces termes textuellement dans ta réponse. C'est la preuve que tu as vraiment lu l'avis, pas un message générique.

━━━ RÈGLE 2 : ZÉRO HALLUCINATION ━━━
Interdiction absolue d'inventer : un plat, un ingrédient, un incident, une personne, une date, ou quoi que ce soit qui n'est PAS cité dans l'avis.
Si le client parle d'attente → tu parles d'attente. S'il parle d'une vue → tu parles de la vue. Rien de plus.
Exemple de faute grave : le client dit "trop salé" → tu n'inventes pas de "chef qui assaisonne généreusement".

━━━ RÈGLE 3 : ATTAQUE DIRECTE - ZÉRO INTRO ROBOTIQUE ━━━
Commence TOUJOURS par répondre directement au cœur de l'avis. Pas de formule d'intro.
STRICTEMENT INTERDITS pour ouvrir : "Bonjour,", "Nous avons bien reçu votre avis", "Merci pour votre retour", "Nous sommes ravis que", "Cher client", "Nous prenons note".
Exemples d'attaques acceptables : "C'est exactement ce qu'on cherche à créer ici." / "Je comprends parfaitement votre déception." / "La terrasse ombragée, c'est notre fierté."

━━━ RÈGLE 4 : RÉPONSE 1:1 ━━━
Chaque point soulevé par le client reçoit une réponse directe.
Si le client pose UNE question précise → réponds à CETTE question précisément, sans élargir.
Si le client soulève 3 problèmes → adresse les 3, dans l'ordre.
Ne noie pas la réponse avec des éléments absents de l'avis.

━━━ RÈGLE 5 : PHRASES COURTES ET PERCUTANTES ━━━
Maximum 20 mots par phrase. Phrases de longueurs variées (certaines ultra-courtes, d'autres un peu plus longues).
Ton de quelqu'un qui sait ce qu'il fait, pas d'un commercial qui récite un script.
${negativeBlock}
━━━ INTERDICTIONS FORMELLES ━━━
Ces expressions sont BANNIES : "Votre satisfaction est notre priorité", "expérience culinaire", "à votre écoute", "Nous restons à votre disposition", "Merci de votre confiance", "à bientôt dans notre établissement", "N'hésitez pas à revenir", "Votre retour est précieux", "désagrément", "Nous prenons note".

━━━ VOUVOIEMENT ━━━
Toujours "vous". Jamais "tu". Même dans un ton décontracté. C'est non négociable.

━━━ MISE EN PAGE ━━━
2 à 3 paragraphes distincts, chacun séparé par UNE LIGNE VIDE.
Jamais un pavé dense.
━━━ SIGNATURE (fin de réponse) ━━━
${signatureInstruction}

━━━ ADAPTATION CLIENT ━━━
TON : ${tonDesc}
LONGUEUR : ${lengthDesc}
${instructions.trim() ? `CONSIGNES PRIORITAIRES (elles priment sur tout, intègre-les naturellement) :\n${instructions.trim()}` : ''}
${params.languageRule ? `\nRÈGLE LANGUE : ${params.languageRule}` : ''}

━━━ FORMAT DE SORTIE ━━━
Texte brut uniquement. Aucun guillemet autour de la réponse. Aucun préambule du type "Voici la réponse :". Aucun [crochet]. Sauts de ligne réels entre paragraphes.
`.trim();
}

function buildUserMessage(params: GenerateReviewParams): string {
  const reviewer = params.reviewerName?.trim() || 'Client';
  const rating = params.rating != null ? `${params.rating}/5` : 'non précisé';
  // L'avis est transmis tel quel — aucune instruction parasite
  return `AVIS À TRAITER :
"${params.avis}"

Auteur : ${reviewer}
Note : ${rating}
Établissement : ${params.establishmentName.trim() || 'notre établissement'}

Génère la réponse en appliquant toutes les règles.`;
}

/**
 * Relecture croisée Claude → OpenAI quand les deux clés sont présentes : fluidifie sans changer les faits.
 * Désactiver : REPUTEXA_DISABLE_DUAL_POLISH=1
 */
export async function dualEnginePolishReviewDraft(draft: string, reviewComment: string): Promise<string> {
  return dualEnginePolishIfEnabled(draft, {
    avis: reviewComment,
    establishmentName: 'établissement',
  });
}

async function dualEnginePolishIfEnabled(draft: string, params: GenerateReviewParams): Promise<string> {
  if (process.env.REPUTEXA_DISABLE_DUAL_POLISH === '1') return draft;
  const openai = getOpenAI();
  const anthropic = getAnthropic();
  if (!openai || !anthropic || !draft.trim()) return draft;
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_FALLBACK_MODEL,
      temperature: 0.35,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `Tu es relecteur pour réponses d'établissement (e-réputation). Le brouillon a été rédigé par un premier moteur ; tu le peaufines.
RÈGLES STRICTES :
- Ne change AUCUN fait, AUCUN détail cité par le client dans l'avis, AUCUN engagement nouveau.
- Conserve le vouvoiement et les mots du client déjà repris.
- Tu peux : fluidifier, couper une répétition, ajuster ponctuation ou une tournure.
Réponds UNIQUEMENT par le texte final de la réponse, sans préambule.`,
        },
        {
          role: 'user',
          content: `Avis client (référence) :\n"""${params.avis.slice(0, 4000)}"""\n\nBrouillon :\n${draft}`,
        },
      ],
    });
    const polished = completion.choices[0]?.message?.content?.trim();
    if (polished && polished.length > 40) return postProcess(polished);
  } catch (e) {
    console.error('[ai-service] dual polish skipped:', e);
  }
  return draft;
}

function postProcess(content: string): string {
  let out = String(content ?? '').trim();
  out = out.replace(/\[.*?\]/g, '');
  out = out.replace(/^["']|["']$/g, '');
  out = out.replace(/^Voici la réponse\s*:?\s*/i, '');
  out = out.replace(/votre retour est précieux/gi, '');
  out = out.replace(/reputexa/gi, "l'établissement");
  // Préserver les sauts de ligne (paragraphes) — ne collapper que les espaces horizontaux
  out = out.replace(/[^\S\n]+/g, ' ');
  // Normaliser : max 2 sauts de ligne consécutifs
  out = out.replace(/\n{3,}/g, '\n\n');
  out = scrubAiTypography(out);
  return out.trim();
}

/**
 * Génère une réponse à un avis client.
 * Utilise Claude 3.5 Sonnet (principal) avec fallback sur GPT-4o mini.
 */
export async function generateReviewResponse(
  params: GenerateReviewParams
): Promise<{ content: string; engine: 'anthropic' | 'openai' }> {
  const systemPrompt = buildMasterPrompt(params);
  const userContent = buildUserMessage(params);

  const anthropic = getAnthropic();
  const openai = getOpenAI();

  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });

      const block = message.content.find((b) => b.type === 'text');
      const text = block && 'text' in block ? block.text : '';
      const cleaned = postProcess(text);
      if (cleaned) {
        return { content: cleaned, engine: 'anthropic' };
      }
    } catch (err) {
      console.error('[ai-service] Anthropic failed, falling back to OpenAI:', err);
    }
  }

  if (!openai) {
    throw new Error(
      'Aucune clé API IA configurée. Configurez ANTHROPIC_API_KEY et/ou OPENAI_API_KEY dans votre .env.'
    );
  }

  const completion = await openai.chat.completions.create({
    model: OPENAI_FALLBACK_MODEL,
    temperature: 0.7,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const cleaned = postProcess(raw);
  return {
    content: cleaned || HUMAN_FALLBACKS.genericThanks,
    engine: 'openai',
  };
}

/**
 * Détection de langue (tâche simple → GPT-4o mini).
 */
export async function detectLanguage(text: string): Promise<string> {
  const openai = getOpenAI();
  if (!openai) return 'fr';

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_FALLBACK_MODEL,
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: 'system',
          content: 'Détecte la langue de ce texte. Réponds UNIQUEMENT par le code ISO (ex: fr, en, es).',
        },
        { role: 'user', content: text.slice(0, 500) },
      ],
    });
    const code = (completion.choices[0]?.message?.content ?? 'fr').trim().toLowerCase().slice(0, 2);
    return code || 'fr';
  } catch {
    return 'fr';
  }
}

/**
 * Analyse de sentiment (tâche simple → GPT-4o mini).
 */
export async function analyzeSentiment(text: string): Promise<{
  positive: boolean;
  score: number;
  summary?: string;
}> {
  const openai = getOpenAI();
  if (!openai) {
    return { positive: true, score: 0.5 };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_FALLBACK_MODEL,
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Analyse le sentiment de cet avis. Réponds en JSON : { "positive": boolean, "score": 0-1 }',
        },
        { role: 'user', content: text.slice(0, 1000) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { positive?: boolean; score?: number };
    return {
      positive: parsed.positive ?? true,
      score: Math.min(1, Math.max(0, Number(parsed.score) ?? 0.5)),
    };
  } catch {
    return { positive: true, score: 0.5 };
  }
}

/**
 * Génération de texte générique (system + user).
 * Utilise Claude en priorité, fallback GPT-4o mini.
 * Pour workflows structurés (Zenith triple judge, etc.).
 */
export async function generateText(params: {
  systemPrompt: string;
  userContent: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Modèle Anthropic explicite (sinon ANTHROPIC_MODEL).
   * Ex. process.env.LEGAL_ANTHROPIC_MODEL pour la publication légale.
   */
  anthropicModel?: string;
}): Promise<string> {
  const { systemPrompt, userContent, temperature = 0.7, maxTokens = 1024, anthropicModel } = params;
  const claudeModel = anthropicModel?.trim() || ANTHROPIC_MODEL;
  const anthropic = getAnthropic();
  const openai = getOpenAI();

  if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: claudeModel,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });
      const block = message.content.find((b) => b.type === 'text');
      const text = block && 'text' in block ? block.text : '';
      if (text) return text;
    } catch (err) {
      console.error('[ai-service] Anthropic generateText failed:', err);
    }
  }

  if (!openai) {
    throw new Error(
      'Aucune clé API IA configurée. Configurez ANTHROPIC_API_KEY et/ou OPENAI_API_KEY.'
    );
  }

  const completion = await openai.chat.completions.create({
    model: OPENAI_FALLBACK_MODEL,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Vérifie que au moins une clé IA est configurée.
 */
export function hasAiConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}
