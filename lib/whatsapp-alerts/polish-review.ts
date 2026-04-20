/**
 * Copywriter IA — Sublimation d'avis clients WhatsApp
 *
 * Fonctions disponibles :
 *  - polishReview()        : Sublime le texte brut du client en avis Google SEO-friendly
 *  - detectSentiment()     : Classifie le sentiment du message (satisfied / dissatisfied / neutral)
 *  - generateCourtesyExit(): Génère une sortie courtoise (refus poli ou empathie insatisfaction)
 *
 * Modèle : gpt-4o-mini (OpenAI) — rapide, économique, qualité suffisante.
 * Règles STRICTES : zéro hallucination, jamais robotique, toujours en langue du client.
 */

import OpenAI from 'openai';
import { HUMAN_KEYBOARD_CHARTER_SNIPPET, scrubAiTypography } from '@/lib/ai/human-keyboard-output';

export type PolishReviewParams = {
  rawReview: string;
  establishmentName: string;
  establishmentType?: string | null;
  /** Ville ou adresse du commerce — renforce le SEO local (ex: "Paris 11e", "Lyon"). */
  city?: string | null;
  /** Période « Défi REPUTEXA » active : préserve prénoms / mentions d’équipe, enrichit depuis les mots du client. */
  internalChallengeActive?: boolean;
};

export type PolishReviewResult = {
  polishedReview: string;
  wasPolished: boolean;
};

const SYSTEM_PROMPT = `Tu es un copywriter expert en avis clients pour des commerces locaux. \
Tu reçois un texte brut envoyé par un client via WhatsApp et tu le transformes en un avis Google percutant.

RÈGLES ABSOLUES :
1. ZÉRO HALLUCINATION : N'invente JAMAIS un fait, un plat, un produit, un incident, un prénom que le client n'a PAS mentionné. Si le client dit "bonne cuisine", tu ne peux pas dire "les pâtes étaient divines".
2. Conserve à 100% le sentiment et la note implicite du client. Ne transforme pas un avis mitigé en éloge.
3. Enrichis le vocabulaire et la fluidité : tourne les phrases de façon plus expressive et naturelle.
4. SEO local : intègre UNE SEULE FOIS et de façon naturelle le nom du commerce et la ville (si fournie). Uniquement si ça s'intègre fluidement. Exemple acceptable : "chez [Nom] à [Ville]".
5. Format cible : 2 à 5 phrases naturelles. Pas de liste. Pas de titre. Pas d'étoiles.
6. Langue : réponds IMPÉRATIVEMENT dans la même langue que le client.
7. Ton : chaleureux, authentique, humain. L'avis doit sonner comme écrit par le client lui-même (pas par un bot).
8. Ne commence JAMAIS par "Je" - varie les entrées en matière.
9. Pas de formule de politesse finale (ex: "Je recommande vivement"). Reste sobre et factuel.
10. JAMAIS de mention de Reputexa, d'IA ou d'outils automatisés.
11. L'avis est rédigé À LA PLACE du client - utilise "je/j'" dans le corps de l'avis, PAS "vous". Le client parle en son nom.

${HUMAN_KEYBOARD_CHARTER_SNIPPET}`;

const CHALLENGE_POLISH_ADDON = `12. DÉFI INTERNE (commerce) : le client peut avoir mentionné un prénom ou un membre du personnel. Conserve ces éléments fidèlement s'ils sont dans son texte - n'invente JAMAIS de prénom, rôle ou visage. Tu peux enrichir le vocabulaire à partir des mots qu'il a déjà utilisés (SEO naturel, zéro bourrage).`;

function buildPolishSystemPrompt(params: PolishReviewParams): string {
  if (params.internalChallengeActive) {
    return `${SYSTEM_PROMPT}\n${CHALLENGE_POLISH_ADDON}`;
  }
  return SYSTEM_PROMPT;
}

function buildUserMessage(params: PolishReviewParams): string {
  const contextLines = [
    `Commerce : ${params.establishmentName}`,
    params.establishmentType ? `Type : ${params.establishmentType}` : null,
    params.city?.trim() ? `Ville / Adresse : ${params.city.trim()}` : null,
    ``,
    `Texte brut du client :`,
    `"${params.rawReview.trim()}"`,
    ``,
    `Génère l'avis Google optimisé (vouvoiement interdit dans l'avis - l'avis doit sonner comme écrit par le client lui-même) :`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');

  return contextLines;
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  return new OpenAI({ apiKey: key });
}

// ── Détection de sentiment ────────────────────────────────────────────────────

export type SentimentResult = 'satisfied' | 'dissatisfied' | 'neutral';

const SENTIMENT_SYSTEM = `Tu es un classificateur de sentiment ultra-rapide pour des messages WhatsApp clients.
Analyse le message et réponds UNIQUEMENT avec un objet JSON valide.

Règles de classification :
- "dissatisfied" : plainte explicite, mécontentement, critique négative, frustration, insatisfaction.
- "satisfied" : expérience positive, remerciements, éloge, satisfaction.
- "neutral" : question, commentaire sans valeur positive/négative claire.

Format de réponse STRICT : {"sentiment": "satisfied"} ou {"sentiment": "dissatisfied"} ou {"sentiment": "neutral"}`;

/**
 * Classifie le sentiment d'un message client via GPT-4o-mini.
 * Appel ultra-rapide (max 20 tokens, température 0).
 * Retourne 'neutral' en cas d'erreur ou d'IA non configurée.
 */
export async function detectSentiment(text: string): Promise<SentimentResult> {
  const openai = getOpenAI();
  if (!openai || text.trim().length < 5) return 'neutral';

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 20,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SENTIMENT_SYSTEM },
        { role: 'user', content: text.trim() },
      ],
    });

    const raw = res.choices[0]?.message?.content ?? '{}';
    const json = JSON.parse(raw) as { sentiment?: string };
    if (json.sentiment === 'satisfied' || json.sentiment === 'dissatisfied') {
      return json.sentiment;
    }
    return 'neutral';
  } catch {
    return 'neutral';
  }
}

// ── Sortie courtoise (Refus ou Insatisfaction) ────────────────────────────────

export type CourtesyType =
  | 'refusal'         // Client a dit "2" / STOP — refus poli avant d'avoir donné un avis
  | 'dissatisfaction'; // Client a exprimé une insatisfaction dans son texte libre

export type CourtesyExitParams = {
  type: CourtesyType;
  establishmentName: string;
  firstName?: string | null;
};

export type CourtesyExitResult = {
  message: string;
};

const COURTESY_SYSTEM = `Vous êtes un conseiller client de luxe représentant un commerce local de standing, communiquant par WhatsApp.

RÈGLES ABSOLUES :
1. IMPÉRATIVEMENT utiliser le "vous" (vouvoiement) et maintenir un ton élégant, chaleureux et professionnel.
2. JAMAIS robotique. Bannis absolument : "votre retour est précieux", "désagrément", "nous prenons note", "n'hésitez pas".
3. 2 phrases maximum. Court, sincère, humain — comme un conseiller attentionné qui répond en personne.
4. Ne proposez JAMAIS de lien Google, d'avis, ni de redirection externe.
5. Ne mentionnez JAMAIS Reputexa, une IA ou des outils automatisés.
6. Pour un refus : remerciez chaleureusement pour la visite, sans insister ni questionner.
7. Pour une insatisfaction : excuses sincères + mentionnez que le retour est transmis à l'équipe. Jamais de demande d'avis.
8. Répondez en français (ou dans la langue détectée dans les instructions).`;

function buildCourtesyPrompt(params: CourtesyExitParams): string {
  const prenom = params.firstName ? ` (prénom du client : ${params.firstName})` : '';

  if (params.type === 'refusal') {
    return (
      `Commerce : "${params.establishmentName}"${prenom}.\n` +
      `Le client ne souhaite pas laisser d'avis. ` +
      `Génère une courte réponse de remerciement pour sa visite, chaleureuse, sans insister.`
    );
  }

  return (
    `Commerce : "${params.establishmentName}"${prenom}.\n` +
    `Le client a exprimé une insatisfaction. ` +
    `Génère une réponse empathique : excuses sincères, ` +
    `mentionne que le feedback est transmis à la direction. ` +
    `NE propose PAS de lien d'avis Google et ne demande PAS au client de réécrire son avis.`
  );
}

/**
 * Génère un message de sortie courtoise via GPT-4o-mini.
 * Fallback statique si OpenAI n'est pas configuré ou renvoie une erreur.
 */
export async function generateCourtesyExit(
  params: CourtesyExitParams
): Promise<CourtesyExitResult> {
  const openai = getOpenAI();

  // Fallbacks statiques (si pas d'API key)
  const staticFallback = (): CourtesyExitResult => {
    if (params.type === 'refusal') {
      return {
        message:
          `Merci pour votre visite chez *${params.establishmentName}* ! ` +
          `Nous espérons vous revoir très bientôt. Excellente journée ! 😊`,
      };
    }
    return {
      message:
        `Nous sommes sincèrement désolés de votre expérience. ` +
        `Votre retour est immédiatement transmis à notre direction pour que nous puissions nous améliorer.`,
    };
  };

  if (!openai) return staticFallback();

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0.7,
      messages: [
        { role: 'system', content: COURTESY_SYSTEM },
        { role: 'user', content: buildCourtesyPrompt(params) },
      ],
    });

    const msg = res.choices[0]?.message?.content?.trim();
    if (!msg) return staticFallback();
    return { message: msg };
  } catch (error) {
    console.error('[polish-review] generateCourtesyExit error:', error);
    return staticFallback();
  }
}

/**
 * Polish un avis client brut via GPT-4o-mini.
 * En cas d'erreur ou d'IA non configurée, retourne le texte original.
 */
export async function polishReview(
  params: PolishReviewParams
): Promise<PolishReviewResult> {
  const openai = getOpenAI();

  // Si pas d'API key configurée, retourner le texte brut tel quel
  if (!openai) {
    console.warn('[polish-review] OpenAI non configuré — retour texte brut.');
    return { polishedReview: params.rawReview, wasPolished: false };
  }

  // Si le texte est trop court pour être amélioré (< 10 chars), retourner tel quel
  if (params.rawReview.trim().length < 10) {
    return { polishedReview: params.rawReview, wasPolished: false };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.6,
      messages: [
        { role: 'system', content: buildPolishSystemPrompt(params) },
        { role: 'user', content: buildUserMessage(params) },
      ],
    });

    const polished = completion.choices[0]?.message?.content?.trim();
    if (!polished) {
      return { polishedReview: params.rawReview, wasPolished: false };
    }

    return { polishedReview: scrubAiTypography(polished), wasPolished: true };
  } catch (error) {
    console.error('[polish-review] Erreur OpenAI :', error);
    return { polishedReview: params.rawReview, wasPolished: false };
  }
}
