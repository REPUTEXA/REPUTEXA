/**
 * Omni-Synapse — types partagés (TypeScript strict).
 * Quatre protocoles : Perception, Cognition, Exécution, Rétroaction.
 */

export type OmniIngestChannel = 'whatsapp' | 'stripe' | 'google' | 'addition' | 'other';

export type OmniInteractionMemoryRow = {
  id: string;
  channel: OmniIngestChannel;
  canonical_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type PsychologistRoundResult = {
  /** Urgence émotionnelle 0–1 (colère, frustration, menace réputationnelle). */
  emotionalUrgency: number;
  /** Synthèse courte pour les autres experts. */
  emotionalSummary: string;
  /** Valence dominante normalisée. */
  dominantValence: 'negative' | 'mixed' | 'positive';
};

export type SeoStrategistRoundResult = {
  /** Mots-clés à renforcer sur la fiche Google ce mois-ci. */
  missingKeywords: string[];
  /** Écart SEO perçu 0–1 (1 = lacune forte). */
  seoGapScore: number;
  rationale: string;
};

export type LoyaltyRoundResult = {
  visitCount: number;
  /** Contribution 0–1 au score de priorité (signal fidélité / Nouveau vs VIP). */
  loyaltyPrioritySignal: number;
  label: 'first_visit' | 'returning' | 'champion';
};

export type RoundTableInput = {
  /** Texte brut ou résumé de l’interaction courante. */
  interactionText: string;
  /** Contexte établissement (ville, catégorie, nom). */
  establishmentContext: string;
  /** Mots-clés SEO déjà suivis (profil). */
  currentSeoKeywords: string[];
  /** Nombre de visites client connues du CRM (≥1). */
  visitCount: number;
};

export type RoundTableResult = {
  psychologist: PsychologistRoundResult;
  strategist: SeoStrategistRoundResult;
  loyalty: LoyaltyRoundResult;
  /**
   * Score de priorité agrégé 0–1.
   * Combinaison « bayésienne » conservative : 1 - ∏(1 - w_i * s_i).
   */
  priorityScore: number;
  expertWeights: {
    psychologist: number;
    strategist: number;
    loyalty: number;
  };
};

export type RedTeamVerdict = {
  approved: boolean;
  gdprIssues: string[];
  robotOrAiArtifacts: string[];
  summary: string;
};

export type HauteCoutureExecutionInput = {
  reviewComment: string;
  reviewerName: string;
  rating: number;
  establishmentName: string;
  businessContext: string;
  userId: string;
  establishmentId: string | null;
  /** Variantes de ton / longueur (aligné zenith-triple-judge). */
  aiTon?: string;
  aiLength?: string;
  aiCustomInstructions?: string;
  /** Fragment appris par rétroaction récursive (profil). */
  recursivePromptAddon?: string | null;
};

export type HauteCoutureExecutionResult = {
  draftReply: string;
  fewShotExemplarsUsed: number;
  redTeam: RedTeamVerdict;
};

export type PublicationFollowupOutcome = 'pending' | 'published' | 'not_published' | 'unknown';
