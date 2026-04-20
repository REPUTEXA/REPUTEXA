/**
 * Orchestrateur central des réponses avis : respect strict Vision / Pulse / Zenith,
 * dual-engine via generateReviewResponse + runTripleJudge, puis contrôle qualité humain.
 */
import type { PlanSlug } from '@/lib/feature-gate';
import { FEATURES, hasFeature } from '@/lib/feature-gate';
import { generateReviewResponse, dualEnginePolishReviewDraft } from '@/lib/ai-service';
import { runTripleJudge } from '@/lib/ai/zenith-triple-judge';
import { humanScreenReviewReply } from '@/lib/ai/human-quality-gate';
import { loadForgeKnowledgeBlock } from '@/lib/ai/forge-knowledge-hook';
import { scoreAutomatedReplyConfidence } from '@/lib/ai/review-reply-confidence';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';
import {
  SMS_WHATSAPP_TONE,
  buildOpeningVariantInstruction,
  openingVariantInstructionByIndex,
} from '@/lib/ai/concierge-prompts';
import { REPUTEXA_CROSS_CUT_AI_VOICE } from '@/lib/ai/reputexa-cross-cut-voice';

export type ReviewReplyBrainInput = {
  planSlug: PlanSlug;
  comment: string;
  reviewerName: string;
  rating: number;
  establishmentName: string;
  businessContext: string;
  seoKeywords: string[];
  profileLanguage: string;
  aiTone?: string | null;
  aiLength?: string | null;
  aiCustomInstructions?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Style additionnel (ex. règles WhatsApp) */
  extraStyleInstruction?: string;
  /** Force la longueur (ex. concise pour mobile) */
  lengthOverride?: 'concise' | 'balanced' | 'detailed';
  /** Omni-Synapse : apprentissage récursif (profil) */
  omniRecursivePromptAddon?: string | null;
  /** Avis antérieur du même auteur sur la fenêtre récente (mémoire relationnelle) */
  repeatVisit?: boolean;
  /** Variante d’ouverture 0–2 (évite d’enchaîner la même structure que la réponse publiée précédente) */
  openingPatternIdx?: number;
};

/** Ouvrir + fidélité : partagé entre triple juge et moteur simple (Vision/Pulse). */
function buildReplyStyleAddons(input: ReviewReplyBrainInput): string {
  const openingV =
    typeof input.openingPatternIdx === 'number' && !Number.isNaN(input.openingPatternIdx)
      ? openingVariantInstructionByIndex(input.openingPatternIdx)
      : buildOpeningVariantInstruction(input.comment.trim(), input.reviewerName.trim() || 'Client');
  const rawName = (input.reviewerName ?? '').trim();
  const pos = typeof input.rating === 'number' && input.rating >= 3;
  const loyalty =
    input.repeatVisit === true
      ? pos
        ? rawName
          ? `MÉMOIRE RELATIONNELLE (Omni-Synapse / historique avis) : l'auteur a déjà laissé un avis sur cette enseigne dans les derniers mois. Ouvrez par une reconnaissance explicite du retour du type « Ravi de vous revoir chez nous, ${rawName} ! Merci pour votre fidélité renouvelée ; nous transmettons votre message à l'équipe. » — reformulez avec vos mots (vouvoiement), sans copier mot pour mot.`
          : `MÉMOIRE RELATIONNELLE (Omni-Synapse / historique avis) : second avis récent du même auteur. Ouvrez par une reconnaissance chaleureuse du retour (« ravi de vous relire », fidélité renouvelée, transmission à l'équipe), sans inventer de fait non cité.`
        : `MÉMOIRE RELATIONNELLE (Omni-Synapse) : l'auteur a déjà un avis antérieur sur cette enseigne. Reconnaissez ce second retour avec gravité et écoute (avis sensible), sans ton festif ni familier.`
      : '';
  return [openingV, loyalty].filter(Boolean).join('\n\n');
}

function buildStyleInstruction(input: ReviewReplyBrainInput): string {
  const toneLabel = (() => {
    switch (input.aiTone) {
      case 'warm':
        return 'chaleureux';
      case 'casual':
        return 'décontracté';
      case 'luxury':
        return 'haut de gamme / luxueux';
      case 'humorous':
        return 'avec une touche légère et souriante, sans être déplacé';
      default:
        return 'professionnel et bienveillant';
    }
  })();

  const lengthLabel = (() => {
    const L = input.lengthOverride ?? input.aiLength;
    switch (L) {
      case 'concise':
        return 'très concises (2 phrases maximum sauf avis très chargés)';
      case 'detailed':
        return 'plus détaillées (3 à 5 phrases)';
      default:
        return 'équilibrées (2 à 4 phrases)';
    }
  })();

  const custom = (input.aiCustomInstructions ?? '').trim();
  const omniAddon = (input.omniRecursivePromptAddon ?? '').trim();
  const addons = buildReplyStyleAddons(input);

  return `
PRÉFÉRENCES DE STYLE À RESPECTER :
- Ton: ${toneLabel}.
- Longueur des réponses: ${lengthLabel}.
- Registre: utilise EXCLUSIVEMENT le vouvoiement (vous) en français ; équivalent formel dans les autres langues.
- Ne jamais signer avec une formule fixe répétitive : conclusion variée, contextuelle.
- Réponses avis **publiques** : **0 ou 1 emoji** au total si le ton le permet (chaleureux / léger), jamais une rangée ni trois emojis ; **ossature toujours différente** d'une réponse à l'autre (pas le même enchaînement merci + détail + au revoir si une variante d'ouverture est fournie, elle prime).
${addons}
${custom ? `- CONSIGNES PRIORITAIRES du professionnel (à intégrer naturellement) : ${custom}` : ''}
${omniAddon ? `- ADAPTATION SYSTÈME (Omni-Synapse — à respecter) :\n${omniAddon}` : ''}
${REPUTEXA_CROSS_CUT_AI_VOICE}
${input.extraStyleInstruction ? input.extraStyleInstruction : ''}`.trim();
}

function visionLanguageRule(profileLanguage: string): string {
  return `Vous devez répondre dans la langue locale de l'établissement (${profileLanguage}). Cependant, pour rester poli, si l'avis du client est dans une autre langue, commencez par une courte phrase de courtoisie dans la langue du client, puis enchaînez exclusivement en ${profileLanguage}.`;
}

function pulseZenithLanguageRule(): string {
  return "Détecte la langue de l'avis et réponds dans la MÊME langue (natif, nuancé).";
}

export type AutomatedReviewReplyResult = {
  text: string;
  confidence: number;
  qualityGateSkipped: boolean;
};

/**
 * Génère la réponse IA avec injection Forge, score de confiance et garde qualité conditionnelle.
 */
export async function produceAutomatedReviewReplyResult(
  input: ReviewReplyBrainInput
): Promise<AutomatedReviewReplyResult> {
  const planSlug = input.planSlug;
  const useTriple = hasFeature(planSlug, FEATURES.TRIPLE_VERIFICATION);
  const useSeo = hasFeature(planSlug, FEATURES.SEO_BOOST);
  const isVision = planSlug === 'vision';

  const languageRule = isVision ? visionLanguageRule(input.profileLanguage) : pulseZenithLanguageRule();

  const profilePhone = (input.phone ?? '').trim();
  const profileEmail = (input.email ?? '').trim();
  const isNegative = typeof input.rating === 'number' && input.rating < 3;
  const contactParts = [profilePhone ? `au ${profilePhone}` : null, profileEmail ? `par email à ${profileEmail}` : null]
    .filter(Boolean)
    .join(' ou ');

  const negativeContactInstruction =
    isNegative && contactParts
      ? `\n\nAVIS NÉGATIF — RÈGLE OBLIGATOIRE : après ta réponse principale, ajoute un paragraphe de réconciliation (ligne vide avant) : "Nous aimerions échanger avec vous pour comprendre ce qu'il s'est passé. N'hésitez pas à nous contacter directement ${contactParts}."`
      : '';

  const forgeAddon = await loadForgeKnowledgeBlock({
    agentKeys: ['reputexa_core', 'nexus'],
    queryHint: input.comment,
    maxSnippets: 14,
  });

  const styleInstruction = buildStyleInstruction(input) + negativeContactInstruction + forgeAddon;

  let draft: string;

  if (useTriple) {
    const tier = useSeo ? 'zenith' : 'pulse';
    const seoKeywords = tier === 'zenith' ? input.seoKeywords : [];
    draft = await runTripleJudge(
      {
        reviewComment: input.comment.trim(),
        reviewerName: input.reviewerName.trim() || 'Client',
        rating: input.rating,
        establishmentName: input.establishmentName.trim(),
        businessContext: input.businessContext,
        seoKeywords,
        styleInstruction,
        aiTon: input.aiTone ?? undefined,
        aiLength: input.lengthOverride ?? input.aiLength ?? undefined,
        aiCustomInstructions: (input.aiCustomInstructions ?? '').trim() || undefined,
      },
      tier
    );
  } else {
    const mergedInstructions = [
      buildReplyStyleAddons(input),
      (input.aiCustomInstructions ?? '').trim(),
    ]
      .filter(Boolean)
      .join('\n\n');
    const { content } = await generateReviewResponse({
      avis: input.comment.trim(),
      reviewerName: input.reviewerName.trim() || 'Client',
      rating: input.rating,
      establishmentName: input.establishmentName.trim(),
      ton: (input.aiTone as string) || 'professional',
      longueur: input.lengthOverride ?? (input.aiLength as string) ?? 'balanced',
      instructions: mergedInstructions || undefined,
      language: isVision ? input.profileLanguage : 'auto',
      languageRule,
      phone: profilePhone || undefined,
      email: profileEmail || undefined,
    });
    draft = content;
  }

  const polished = await dualEnginePolishReviewDraft(draft, input.comment);

  const confidence = await scoreAutomatedReplyConfidence({
    draft: polished,
    reviewComment: input.comment,
    rating: input.rating,
    establishmentName: input.establishmentName.trim(),
  });

  const skipMin = Number(process.env.FORGE_SKIP_QUALITY_GATE_AT ?? '');
  const skipGate =
    Number.isFinite(skipMin) &&
    skipMin > 0 &&
    confidence >= skipMin &&
    process.env.FORGE_INJECTION_ENABLED !== '0';

  const text = skipGate
    ? scrubAiTypography(polished)
    : await humanScreenReviewReply({
        draft: polished,
        reviewComment: input.comment,
        establishmentName: input.establishmentName,
      });

  return { text, confidence, qualityGateSkipped: skipGate };
}

/**
 * Génère la réponse IA finale (auto-publiable ou suggestion), avec garde qualité.
 */
export async function produceAutomatedReviewReply(input: ReviewReplyBrainInput): Promise<string> {
  const r = await produceAutomatedReviewReplyResult(input);
  return r.text;
}

/** Raccourci suggestion WhatsApp (Pulse/Zenith) : ton mobile + phrases courtes */
export async function produceWhatsAppSuggestedReply(input: Omit<ReviewReplyBrainInput, 'extraStyleInstruction' | 'lengthOverride'>): Promise<string> {
  return produceAutomatedReviewReply({
    ...input,
    lengthOverride: 'concise',
    extraStyleInstruction: `\n${SMS_WHATSAPP_TONE}\nSortie courte : 2–3 phrases maximum pour lecture sur téléphone, sans sacrifier le miroir des propos du client.`,
  });
}
