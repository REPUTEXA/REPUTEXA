/**
 * Feature Gate REPUTEXA — Matrice des offres (infranchissable).
 * Plan: vision | pulse | zenith
 */

export type PlanSlug = 'vision' | 'pulse' | 'zenith' | 'free';

const PLAN_ORDER: PlanSlug[] = ['free', 'vision', 'pulse', 'zenith'];

/** Fonctionnalités et plan minimum requis */
export const FEATURES = {
  /** Réponses IA langue locale uniquement (Vision) */
  AI_REPLIES_LOCAL: 'ai_replies_local',
  /** Réponses IA toutes langues / natif (Pulse+) */
  AI_REPLIES_ALL_LANGUAGES: 'ai_replies_all_languages',
  /** Triple rédaction + juge (3 prototypes, meilleure sélection) — Pulse et Zenith */
  TRIPLE_VERIFICATION: 'triple_verification',
  /** Reporting PDF mensuel simple — Vision+ */
  REPORTING_PDF: 'reporting_pdf',
  /** Récap hebdo WhatsApp — Pulse+ */
  REPORTING_WHATSAPP_RECAP: 'reporting_whatsapp_recap',
  /** Alertes WhatsApp immédiates avis négatifs — Pulse+ */
  WHATSAPP_ALERTS: 'whatsapp_alerts',
  /** Suppression / Bouclier avis haineux — Pulse+ */
  SHIELD_HATEFUL: 'shield_hateful',
  /** IA Capture (WhatsApp 30 min après visite) — Zenith */
  AI_CAPTURE: 'ai_capture',
  /** Connecteurs Caisse OAuth (Square, SumUp) — Zenith */
  POS_CONNECTOR: 'pos_connector',
  /** Boost SEO : injection mots-clés dans réponses IA — Zenith */
  SEO_BOOST: 'seo_boost',
  /** Chat Consultant Stratégique 24/7 — Zenith */
  CONSULTANT_CHAT: 'consultant_chat',
  /** Rapport mensuel fidélité / collaborateurs pour comptable (PDF, CSV) — Zenith */
  COMPTA_BANANO_EXPERT: 'compta_banano_expert',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/** Plan minimum pour chaque fonctionnalité */
const FEATURE_MIN_PLAN: Record<FeatureKey, PlanSlug> = {
  [FEATURES.AI_REPLIES_LOCAL]: 'vision',
  [FEATURES.AI_REPLIES_ALL_LANGUAGES]: 'pulse',
  [FEATURES.TRIPLE_VERIFICATION]: 'pulse',
  [FEATURES.REPORTING_PDF]: 'vision',
  [FEATURES.REPORTING_WHATSAPP_RECAP]: 'pulse',
  [FEATURES.WHATSAPP_ALERTS]: 'pulse',
  [FEATURES.SHIELD_HATEFUL]: 'pulse',
  [FEATURES.AI_CAPTURE]: 'zenith',
  [FEATURES.POS_CONNECTOR]: 'zenith',
  [FEATURES.SEO_BOOST]: 'zenith',
  [FEATURES.CONSULTANT_CHAT]: 'zenith',
  [FEATURES.COMPTA_BANANO_EXPERT]: 'zenith',
};

/** Libellé du plan pour les messages upsell */
export const PLAN_DISPLAY: Record<PlanSlug, string> = {
  free: 'Gratuit',
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'ZENITH',
};

function planLevel(plan: PlanSlug): number {
  const i = PLAN_ORDER.indexOf(plan);
  return i === -1 ? 0 : i + 1;
}

/**
 * Vérifie si le plan de l'utilisateur atteint le plan requis.
 * @param userPlan - Plan actuel (vision | pulse | zenith)
 * @param requiredPlan - Plan minimum requis
 */
export function checkPlan(userPlan: PlanSlug | null, requiredPlan: PlanSlug): boolean {
  if (!userPlan || !PLAN_ORDER.includes(userPlan)) return false;
  return planLevel(userPlan) >= planLevel(requiredPlan);
}

/** Vérifie si le plan a accès à la fonctionnalité */
export function hasFeature(selectedPlan: PlanSlug | null, feature: FeatureKey): boolean {
  if (!selectedPlan || !PLAN_ORDER.includes(selectedPlan)) return false;
  const minPlan = FEATURE_MIN_PLAN[feature];
  return planLevel(selectedPlan) >= planLevel(minPlan);
}

/** Retourne le plan minimum requis pour la fonctionnalité (pour le modal upsell) */
export function getRequiredPlanForFeature(feature: FeatureKey): PlanSlug {
  return FEATURE_MIN_PLAN[feature];
}

/** Nom du plan requis pour affichage */
export function getRequiredPlanDisplayName(feature: FeatureKey): string {
  return PLAN_DISPLAY[FEATURE_MIN_PLAN[feature]];
}

/** Mappe une chaîne plan vers un slug connu, ou null si vide / non reconnu. */
function parseKnownPlanSegment(raw: string): PlanSlug | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s === 'free') return 'free';
  if (s === 'vision' || s === 'starter') return 'vision';
  if (s === 'pulse' || s === 'manager') return 'pulse';
  if (s === 'zenith' || s === 'dominator') return 'zenith';
  return null;
}

/**
 * Normalise subscription_plan (vision/pulse/zenith/free ou legacy starter/manager/dominator) vers PlanSlug.
 * Priorité à `subscriptionPlan` (vérité Stripe / essai en cours) ; `selectedPlan` sert surtout de repli
 * quand la souscription n’est pas encore synchronisée (ex. tout juste après inscription).
 */
export function toPlanSlug(subscriptionPlan: string | null, selectedPlan?: string | null): PlanSlug {
  const fromSub = parseKnownPlanSegment(subscriptionPlan ?? '');
  if (fromSub) return fromSub;
  const fromSel = parseKnownPlanSegment(selectedPlan ?? '');
  if (fromSel) return fromSel;
  return 'vision';
}
