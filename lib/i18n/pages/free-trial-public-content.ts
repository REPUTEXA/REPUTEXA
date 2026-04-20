export type FreeTrialFeatureIconKey = 'brain' | 'shield' | 'trendingUp' | 'bell' | 'arrowRight' | 'zap';

import { formatPlanAmountForLocale } from '@/lib/i18n/pricing-message-format';

export type FreeTrialPublicContent = {
  trialFeatures: { iconKey: FreeTrialFeatureIconKey; label: string; desc: string }[];
  testimonialsMini: { name: string; role: string; quote: string; rating: number }[];
  steps: { n: string; title: string; desc: string }[];
  plansCompare: { feature: string; vision: string; pulse: string; zenith: string }[];
  heroBadges: string[];
  heroTitle: string;
  heroBody: string;
  heroCta: string;
  heroFootnote: string;
  includedTitle: string;
  stepsTitle: string;
  miniTestimonialsTitle: string;
  compareTitle: string;
  tableFeatureCol: string;
  trustLabels: { key: 'lock' | 'shield' | 'checkCircle' | 'star'; label: string }[];
  finalCta: string;
  loginPrompt: string;
  loginLink: string;
};

const FR: FreeTrialPublicContent = {
  trialFeatures: [
    {
      iconKey: 'brain',
      label: 'IA Claude 3.5 Sonnet · génération illimitée',
      desc: 'Moteur principal Anthropic + fallback GPT-4o-mini. ADN IA configurable (ton, longueur, instructions).',
    },
    {
      iconKey: 'shield',
      label: 'Shield Center complet · toxicité + contestation',
      desc: "Détection de 4 catégories, score d'authenticité, rapport de contestation Google automatique.",
    },
    {
      iconKey: 'trendingUp',
      label: 'Dashboard & Statistiques · accès total',
      desc: 'Tableaux de bord temps réel, évolution de note sur 12 mois, analyse de sentiments.',
    },
    {
      iconKey: 'bell',
      label: 'Alertes WhatsApp immédiates · activées',
      desc: 'Boutons interactifs Approuver / Modifier directement depuis WhatsApp. Résumé hebdomadaire inclus.',
    },
    {
      iconKey: 'arrowRight',
      label: 'Consultant IA Stratégique · inclus',
      desc: 'Agent conversationnel Claude 3.5 disponible 24h/24 dans votre dashboard.',
    },
    {
      iconKey: 'zap',
      label: 'AI Capture + Connecteur POS · actif',
      desc: 'Module ZENITH : invitation automatique via WhatsApp 30min après chaque visite.',
    },
  ],
  testimonialsMini: [
    {
      name: 'Thomas B.',
      role: 'Restaurateur, Lyon',
      quote: "En 3 jours d'essai, j'ai répondu à 47 avis accumulés. L'IA est bluffante.",
      rating: 5,
    },
    {
      name: 'Amélie R.',
      role: 'Hôtelière, Nice',
      quote: "On est passé de 3,8 à 4,3 étoiles pendant les 14 jours d'essai. On a signé immédiatement.",
      rating: 5,
    },
    {
      name: 'Marc F.',
      role: 'Réseau coiffure, Paris',
      quote: "La configuration de 12 salons en 20 minutes. Je n'y croyais pas, et pourtant.",
      rating: 5,
    },
  ],
  steps: [
    { n: '1', title: 'Créez votre compte', desc: 'Email et mot de passe — aucune carte bancaire requise.' },
    {
      n: '2',
      title: 'Connectez Google',
      desc: 'Authentification OAuth en 30 secondes. REPUTEXA importe automatiquement vos avis.',
    },
    {
      n: '3',
      title: 'Recevez vos premières suggestions',
      desc: "L'IA analyse vos avis existants et génère des réponses en moins de 60 secondes.",
    },
  ],
  plansCompare: [
    /* Ligne 0 : montants écrasés par mergeCatalogPrices() depuis targets/settings.json */
    { feature: 'Prix mensuel (1 établissement)', vision: '—', pulse: '—', zenith: '—' },
    {
      feature: 'Langue des réponses IA',
      vision: 'Locale uniquement',
      pulse: 'Toutes langues (détectée)',
      zenith: 'Toutes langues',
    },
    { feature: 'Triple Juge IA (3 variantes)', vision: '—', pulse: '✓ Inclus', zenith: '✓ Inclus' },
    { feature: 'Rapport PDF mensuel', vision: '✓ Inclus', pulse: '✓ Inclus', zenith: '✓ Inclus' },
    {
      feature: 'Shield Center',
      vision: 'Détection basique',
      pulse: 'Complet + contestation Google',
      zenith: 'Complet + contestation Google',
    },
    { feature: 'Alertes WhatsApp immédiates', vision: '—', pulse: '✓ Inclus', zenith: '✓ Inclus' },
    { feature: 'Résumé hebdo WhatsApp', vision: '—', pulse: '✓ Inclus', zenith: '✓ Inclus' },
    { feature: 'AI Capture (visites → avis)', vision: '—', pulse: '—', zenith: '✓ Inclus' },
    { feature: 'Connecteur POS (Square, SumUp)', vision: '—', pulse: '—', zenith: '✓ Inclus' },
    { feature: 'Boost SEO (mots-clés injectés)', vision: '—', pulse: '—', zenith: '✓ Inclus' },
    { feature: 'Consultant IA Stratégique 24/7', vision: '—', pulse: '—', zenith: '✓ Inclus' },
  ],
  heroBadges: ['Sans carte bancaire', 'Sans engagement', '14 jours complets', 'Accès ZENITH total'],
  heroTitle: 'Prêt à transformer votre e-réputation ?',
  heroBody:
    'Rejoignez 3 200+ établissements qui ont amélioré leur note Google de +0,7 étoile en moyenne en 6 mois. Commencez maintenant — votre premier avis IA est généré en moins de 60 secondes.',
  heroCta: 'Démarrer mon essai gratuit',
  heroFootnote: 'Conversion en payant uniquement si vous choisissez un plan · Annulation en 1 clic',
  includedTitle: 'Ce que vous obtenez — gratuitement',
  stepsTitle: 'Opérationnel en moins de 5 minutes',
  miniTestimonialsTitle: "Ce qu'ils ont dit de leur premier essai",
  compareTitle: "Comparez les plans — choisissez après l'essai",
  tableFeatureCol: 'Fonctionnalité',
  trustLabels: [
    { key: 'lock', label: 'Données hébergées en EU' },
    { key: 'shield', label: 'Conforme RGPD' },
    { key: 'checkCircle', label: 'Annulation en 1 clic' },
    { key: 'star', label: 'Note 4,9★ sur G2' },
  ],
  finalCta: "Commencer mon essai — c'est gratuit",
  loginPrompt: 'Déjà un compte ?',
  loginLink: 'Se connecter',
};

const EN: FreeTrialPublicContent = {
  trialFeatures: [
    {
      iconKey: 'brain',
      label: 'Claude 3.5 Sonnet AI · unlimited generation',
      desc: 'Anthropic primary + GPT-4o-mini fallback. Tune tone, length, and instructions.',
    },
    {
      iconKey: 'shield',
      label: 'Full Shield Center · toxicity + disputes',
      desc: 'Four signal classes, authenticity score, auto Google dispute draft.',
    },
    {
      iconKey: 'trendingUp',
      label: 'Dashboard & analytics · full access',
      desc: 'Live dashboards, 12-month rating trend, sentiment breakdown.',
    },
    {
      iconKey: 'bell',
      label: 'Instant WhatsApp alerts · on',
      desc: 'Approve / Edit buttons in WhatsApp. Weekly digest included.',
    },
    {
      iconKey: 'arrowRight',
      label: 'AI strategy consultant · included',
      desc: 'Claude 3.5 conversational agent 24/7 in your dashboard.',
    },
    {
      iconKey: 'zap',
      label: 'AI Capture + POS connector · active',
      desc: 'ZENITH: auto WhatsApp invite ~30 minutes after each visit.',
    },
  ],
  testimonialsMini: [
    {
      name: 'Thomas B.',
      role: 'Restaurateur, Lyon',
      quote: 'Three days into the trial I cleared 47 backlogged reviews. The AI is stunning.',
      rating: 5,
    },
    {
      name: 'Amélie R.',
      role: 'Hotelier, Nice',
      quote: 'We went from 3.8 to 4.3★ during the 14-day trial. We subscribed immediately.',
      rating: 5,
    },
    {
      name: 'Marc F.',
      role: 'Hair salon network, Paris',
      quote: 'Twelve salons configured in 20 minutes. I did not think it was possible.',
      rating: 5,
    },
  ],
  steps: [
    { n: '1', title: 'Create your account', desc: 'Email and password—no card required.' },
    { n: '2', title: 'Connect Google', desc: 'OAuth in ~30 seconds. REPUTEXA imports your reviews.' },
    { n: '3', title: 'Get your first drafts', desc: 'AI analyzes existing threads and replies in under 60 seconds.' },
  ],
  plansCompare: [
    { feature: 'Monthly price (1 location)', vision: '—', pulse: '—', zenith: '—' },
    { feature: 'AI reply languages', vision: 'Local only', pulse: 'All (auto-detect)', zenith: 'All' },
    { feature: 'Triple-judge AI (3 variants)', vision: '—', pulse: '✓ Included', zenith: '✓ Included' },
    { feature: 'Monthly PDF report', vision: '✓ Included', pulse: '✓ Included', zenith: '✓ Included' },
    {
      feature: 'Shield Center',
      vision: 'Basic detection',
      pulse: 'Full + Google disputes',
      zenith: 'Full + Google disputes',
    },
    { feature: 'Instant WhatsApp alerts', vision: '—', pulse: '✓ Included', zenith: '✓ Included' },
    { feature: 'Weekly WhatsApp digest', vision: '—', pulse: '✓ Included', zenith: '✓ Included' },
    { feature: 'AI Capture (visit → review)', vision: '—', pulse: '—', zenith: '✓ Included' },
    { feature: 'POS connector (Square, SumUp)', vision: '—', pulse: '—', zenith: '✓ Included' },
    { feature: 'SEO boost (injected keywords)', vision: '—', pulse: '—', zenith: '✓ Included' },
    { feature: 'AI strategy consultant 24/7', vision: '—', pulse: '—', zenith: '✓ Included' },
  ],
  heroBadges: ['No card required', 'No commitment', 'Full 14 days', 'Full ZENITH access'],
  heroTitle: 'Ready to upgrade your online reputation?',
  heroBody:
    'Join 3,200+ locations that gained about +0.7★ on average within six months. Start now—your first AI draft ships in under 60 seconds.',
  heroCta: 'Start my free trial',
  heroFootnote: 'Pay only if you pick a paid plan · Cancel in one click',
  includedTitle: 'What you get—for free',
  stepsTitle: 'Live in under five minutes',
  miniTestimonialsTitle: 'What people said after their first trial',
  compareTitle: 'Compare plans—decide after the trial',
  tableFeatureCol: 'Feature',
  trustLabels: [
    { key: 'lock', label: 'EU-hosted data' },
    { key: 'shield', label: 'GDPR aligned' },
    { key: 'checkCircle', label: 'One-click cancel' },
    { key: 'star', label: '4.9★ on G2' },
  ],
  finalCta: 'Start my trial—it is free',
  loginPrompt: 'Already have an account?',
  loginLink: 'Log in',
};

function mergeCatalogPrices(base: FreeTrialPublicContent, loc: string): FreeTrialPublicContent {
  const row0 = {
    ...base.plansCompare[0],
    vision: formatPlanAmountForLocale(loc, 'vision'),
    pulse: formatPlanAmountForLocale(loc, 'pulse'),
    zenith: formatPlanAmountForLocale(loc, 'zenith'),
  };
  return {
    ...base,
    plansCompare: [row0, ...base.plansCompare.slice(1)],
  };
}

export function getFreeTrialPublicContent(locale: string): FreeTrialPublicContent {
  const base = locale === 'fr' ? FR : EN;
  return mergeCatalogPrices(base, locale);
}
