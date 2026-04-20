import type { LucideIcon } from 'lucide-react';
import {
  Shield,
  Brain,
  TrendingUp,
  Bell,
  FileText,
  MessageSquare,
  Zap,
  BarChart2,
  CheckCircle,
  ArrowRight,
  Globe,
  Smartphone,
  ShoppingCart,
  Star,
} from 'lucide-react';

export type FeatureMatrixCapability = { icon: LucideIcon; label: string; plan: string };

export type FeatureMatrixBlock = {
  id: string;
  icon: LucideIcon;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  vision: boolean;
  pulse: boolean;
  zenith: boolean;
  capabilities: FeatureMatrixCapability[];
  highlight: boolean;
};

const FEATURES_MATRIX_FR: FeatureMatrixBlock[] = [
  {
    id: 'ia-engine',
    icon: Brain,
    badge: 'Moteur IA Dual-Engine',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    title: 'Réponses IA Claude 3.5 Sonnet',
    subtitle: "La précision d'un rédacteur expert, la vitesse d'une machine.",
    description:
      "REPUTEXA utilise Claude 3.5 Sonnet d'Anthropic comme moteur principal de génération. En cas d'indisponibilité, GPT-4o-mini prend automatiquement le relais. Chaque réponse intègre l'effet miroir (réutilisation des mots-clés de l'avis), l'ADN de votre marque et les instructions personnalisées que vous avez définies.",
    vision: true,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: MessageSquare, label: "Langue locale de l'établissement (Vision)", plan: 'VISION' },
      { icon: Globe, label: "Détection automatique de la langue de l'avis (Pulse+)", plan: 'PULSE' },
      {
        icon: Star,
        label:
          "Triple Juge : 3 variantes (empathie / storytelling / expertise) — l'IA sélectionne la meilleure",
        plan: 'PULSE',
      },
      {
        icon: Brain,
        label:
          'ADN IA personnalisable : ton (professional, warm, luxury, casual), longueur, instructions propres',
        plan: 'VISION',
      },
      { icon: Zap, label: 'Génération en quelques secondes avec fallback automatique GPT-4o-mini', plan: 'VISION' },
      {
        icon: CheckCircle,
        label: 'Aucune hallucination grâce aux règles strictes "Effet Miroir" et "Zéro Hallucination"',
        plan: 'VISION',
      },
    ],
    highlight: false,
  },
  {
    id: 'shield',
    icon: Shield,
    badge: 'Shield Center',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    title: 'Surveillance & Protection en temps réel',
    subtitle: 'Votre bouclier permanent contre les atteintes à votre réputation.',
    description:
      "Le Shield Center analyse chaque avis reçu pour détecter la toxicité (haine, spam, conflit d'intérêt, doxxing) et l'authenticité. Il génère un score de fiabilité et, sur PULSE+, produit automatiquement un rapport de contestation conforme aux exigences de Google pour les avis frauduleux.",
    vision: true,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: Shield, label: 'Détection de 4 catégories : haine / spam / doxxing / conflit d’intérêt', plan: 'VISION' },
      { icon: Star, label: "Score d'authenticité calculé sur chaque avis reçu", plan: 'VISION' },
      { icon: FileText, label: 'Rapport de contestation Google généré automatiquement (~200 mots, argumenté)', plan: 'PULSE' },
      { icon: Bell, label: 'Alertes WhatsApp immédiates pour les avis les plus critiques', plan: 'PULSE' },
      { icon: CheckCircle, label: 'Analyse en parallèle de la génération de réponse (sans ralentissement)', plan: 'VISION' },
      { icon: ArrowRight, label: 'Tableau de bord Alertes dédié avec actions rapides (ignorer / contester)', plan: 'VISION' },
    ],
    highlight: true,
  },
  {
    id: 'whatsapp',
    icon: Smartphone,
    badge: 'Alertes WhatsApp',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    title: 'Notifications & Workflow WhatsApp',
    subtitle: 'Traitez chaque avis directement depuis votre téléphone.',
    description:
      "Dès qu'un avis négatif est reçu, REPUTEXA vous envoie une alerte WhatsApp avec le texte de l'avis et la réponse IA suggérée. Deux boutons interactifs vous permettent d'approuver ou de modifier la réponse directement depuis WhatsApp — sans ouvrir le dashboard.",
    vision: false,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: Bell, label: 'Alerte WhatsApp immédiate à chaque avis négatif (seuil configurable)', plan: 'PULSE' },
      {
        icon: MessageSquare,
        label: 'Boutons interactifs : Approuver ou Modifier la réponse IA sans ouvrir le dashboard',
        plan: 'PULSE',
      },
      { icon: Zap, label: 'Publication avec délai humain simulé (2–7h) pour un rendu naturel', plan: 'PULSE' },
      { icon: BarChart2, label: 'Résumé hebdomadaire de votre réputation directement sur WhatsApp', plan: 'PULSE' },
      { icon: CheckCircle, label: 'Compatible Twilio (principal) et Meta Cloud API', plan: 'PULSE' },
      { icon: Star, label: 'Transcription vocale Whisper-1 : répondez à voix haute depuis WhatsApp', plan: 'PULSE' },
    ],
    highlight: false,
  },
  {
    id: 'ai-capture',
    icon: TrendingUp,
    badge: 'AI Capture',
    badgeColor: 'bg-amber-500/20 text-amber-400',
    title: "Collecte d'avis automatisée après visite",
    subtitle: "Plus d'avis positifs, mécaniquement — sans effort de votre part.",
    description:
      "Le module AI Capture envoie automatiquement un message WhatsApp à vos clients 30 minutes après leur visite pour les inviter à partager leur expérience. Si le retour est positif, il leur propose de publier un avis Google optimisé SEO. Si négatif, il capture le feedback en privé pour votre équipe.",
    vision: false,
    pulse: false,
    zenith: true,
    capabilities: [
      { icon: Smartphone, label: 'Message WhatsApp automatique 30 minutes après la visite', plan: 'ZENITH' },
      { icon: TrendingUp, label: 'Feedback positif → invitation à publier un avis Google optimisé SEO', plan: 'ZENITH' },
      { icon: Shield, label: 'Feedback négatif → capturé en privé, jamais publié, transmis à votre équipe', plan: 'ZENITH' },
      { icon: ShoppingCart, label: 'Connecteur POS natif : Square, SumUp (données de visite en temps réel)', plan: 'ZENITH' },
      {
        icon: Globe,
        label: 'Anti-spam : intervalle minimal de 120 jours entre deux sollicitations par numéro, liste noire gérée',
        plan: 'ZENITH',
      },
      { icon: CheckCircle, label: 'Déclenchement via webhook API (POS, Zapier, Make) avec clé rtx_live_', plan: 'ZENITH' },
    ],
    highlight: false,
  },
  {
    id: 'seo',
    icon: Zap,
    badge: 'Boost SEO',
    badgeColor: 'bg-pink-500/20 text-pink-400',
    title: 'Injection de mots-clés SEO dans les réponses',
    subtitle: 'Chaque réponse améliore votre positionnement local Google.',
    description:
      "Le Boost SEO injecte vos mots-clés stratégiques (plats signature, services, quartier) de façon naturelle dans les réponses IA. Google indexe les réponses aux avis — chaque réponse devient une micro-page optimisée pour le référencement local.",
    vision: false,
    pulse: false,
    zenith: true,
    capabilities: [
      { icon: TrendingUp, label: 'Injection naturelle de mots-clés configurés dans vos réponses IA', plan: 'ZENITH' },
      { icon: Brain, label: 'Le système ZENITH Triple Juge sélectionne la variante la plus SEO-friendly', plan: 'ZENITH' },
      { icon: Globe, label: "Compatible avec les règles d'indexation Google Business (réponses propriétaire)", plan: 'ZENITH' },
      { icon: BarChart2, label: 'Configurez vos mots-clés prioritaires dans Paramètres → ADN IA', plan: 'ZENITH' },
    ],
    highlight: false,
  },
  {
    id: 'reporting',
    icon: BarChart2,
    badge: 'Reporting',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
    title: 'Tableau de bord & Rapports PDF mensuels',
    subtitle: 'Vos données de réputation, enfin lisibles et actionnables.',
    description:
      "Dashboard temps réel avec évolution de la note, distribution par plateforme, analyse de sentiments et KPIs clés. Un rapport PDF mensuel est généré automatiquement par l'IA avec analyse des tendances et recommandations pour le mois suivant — disponible dès le plan VISION.",
    vision: true,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: BarChart2, label: 'Dashboard temps réel : note moyenne, volume, évolution sur 12 mois', plan: 'VISION' },
      { icon: Globe, label: 'Distribution par plateforme (Google, Facebook, Trustpilot)', plan: 'VISION' },
      { icon: FileText, label: 'Rapport PDF mensuel automatique — dès VISION', plan: 'VISION' },
      { icon: Brain, label: 'Analyse de sentiments par catégorie (service, ambiance, prix…)', plan: 'VISION' },
      { icon: Star, label: 'Insights hebdomadaires IA envoyés par WhatsApp (Pulse+)', plan: 'PULSE' },
    ],
    highlight: false,
  },
  {
    id: 'consultant',
    icon: MessageSquare,
    badge: 'Consultant IA Stratégique',
    badgeColor: 'bg-indigo-500/20 text-indigo-400',
    title: 'Votre stratège e-réputation disponible 24/7',
    subtitle: 'Un expert IA formé sur des milliers de cas réels.',
    description:
      "Le Consultant Stratégique est un agent IA conversationnel (Claude 3.5 Sonnet + RAG sur votre historique) disponible 24h/24 dans votre dashboard. Il analyse votre situation spécifique, identifie les tendances critiques et vous propose des plans d'action concrets.",
    vision: false,
    pulse: false,
    zenith: true,
    capabilities: [
      { icon: Brain, label: "Claude 3.5 Sonnet + accès à votre historique d'avis en temps réel", plan: 'ZENITH' },
      { icon: MessageSquare, label: 'Interface de chat dédiée dans le dashboard → Consultant', plan: 'ZENITH' },
      { icon: Shield, label: 'Conseils spécialisés sur la gestion de crise et les avis frauduleux', plan: 'ZENITH' },
      { icon: TrendingUp, label: "Plans d'action personnalisés et priorisés selon vos données réelles", plan: 'ZENITH' },
    ],
    highlight: false,
  },
];

const FEATURES_MATRIX_EN: FeatureMatrixBlock[] = [
  {
    id: 'ia-engine',
    icon: Brain,
    badge: 'Dual-engine AI',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    title: 'Claude 3.5 Sonnet AI replies',
    subtitle: 'Expert-level wording at machine speed.',
    description:
      'REPUTEXA uses Anthropic Claude 3.5 Sonnet as the primary generator, with automatic failover to GPT-4o-mini. Every reply applies mirror phrasing (keywords from the review), your brand DNA and the instructions you configure.',
    vision: true,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: MessageSquare, label: 'Establishment default language (Vision)', plan: 'VISION' },
      { icon: Globe, label: 'Auto-detect review language (Pulse+)', plan: 'PULSE' },
      {
        icon: Star,
        label: 'Triple judge: three variants (empathy / storytelling / expertise) — AI picks the best',
        plan: 'PULSE',
      },
      {
        icon: Brain,
        label: 'Custom AI DNA: tone (professional, warm, luxury, casual), length, custom instructions',
        plan: 'VISION',
      },
      { icon: Zap, label: 'Sub-second generation with automatic GPT-4o-mini fallback', plan: 'VISION' },
      {
        icon: CheckCircle,
        label: 'Strict “mirror” and “zero hallucination” rules — no invented facts',
        plan: 'VISION',
      },
    ],
    highlight: false,
  },
  {
    id: 'shield',
    icon: Shield,
    badge: 'Shield Center',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    title: 'Real-time monitoring & protection',
    subtitle: 'Always-on defence for your reputation.',
    description:
      'Shield Center scores every review for toxicity (hate, spam, conflict of interest, doxxing) and authenticity. On PULSE+ it can auto-draft a Google-ready dispute brief for fraudulent reviews.',
    vision: true,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: Shield, label: 'Four detection lanes: hate / spam / doxxing / conflict of interest', plan: 'VISION' },
      { icon: Star, label: 'Authenticity score on every review', plan: 'VISION' },
      { icon: FileText, label: 'Auto-generated Google dispute brief (~200 words, structured)', plan: 'PULSE' },
      { icon: Bell, label: 'Instant WhatsApp alerts for the highest-risk reviews', plan: 'PULSE' },
      { icon: CheckCircle, label: 'Runs in parallel with reply generation — no slowdown', plan: 'VISION' },
      { icon: ArrowRight, label: 'Dedicated Alerts dashboard (dismiss / dispute)', plan: 'VISION' },
    ],
    highlight: true,
  },
  {
    id: 'whatsapp',
    icon: Smartphone,
    badge: 'WhatsApp alerts',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    title: 'WhatsApp notifications & workflow',
    subtitle: 'Handle reviews from your phone.',
    description:
      'When a negative review arrives, REPUTEXA sends a WhatsApp alert with the review text and suggested AI reply. Interactive buttons let you approve or edit without opening the dashboard.',
    vision: false,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: Bell, label: 'Immediate WhatsApp alert per negative review (threshold configurable)', plan: 'PULSE' },
      { icon: MessageSquare, label: 'Interactive buttons: approve or edit the AI reply from WhatsApp', plan: 'PULSE' },
      { icon: Zap, label: 'Publishing with a human-like delay (2–7h)', plan: 'PULSE' },
      { icon: BarChart2, label: 'Weekly reputation digest on WhatsApp', plan: 'PULSE' },
      { icon: CheckCircle, label: 'Twilio-first, Meta Cloud API compatible', plan: 'PULSE' },
      { icon: Star, label: 'Whisper-1 voice replies from WhatsApp', plan: 'PULSE' },
    ],
    highlight: false,
  },
  {
    id: 'ai-capture',
    icon: TrendingUp,
    badge: 'AI Capture',
    badgeColor: 'bg-amber-500/20 text-amber-400',
    title: 'Automated post-visit review capture',
    subtitle: 'More positive reviews, on autopilot.',
    description:
      'AI Capture sends a WhatsApp message 30 minutes after a visit to invite feedback. Positive experiences get a nudge to post on Google with SEO-friendly wording; negative feedback is captured privately for your team.',
    vision: false,
    pulse: false,
    zenith: true,
    capabilities: [
      { icon: Smartphone, label: 'Automatic WhatsApp message 30 minutes after the visit', plan: 'ZENITH' },
      { icon: TrendingUp, label: 'Positive feedback → invite to post an SEO-tuned Google review', plan: 'ZENITH' },
      { icon: Shield, label: 'Negative feedback → private capture, never published', plan: 'ZENITH' },
      { icon: ShoppingCart, label: 'Native POS connectors: Square, SumUp (live visit data)', plan: 'ZENITH' },
      {
        icon: Globe,
        label: 'Anti-spam: minimum 120 days between prompts per number, blocklist supported',
        plan: 'ZENITH',
      },
      { icon: CheckCircle, label: 'Trigger via inbound API webhook (POS, Zapier, Make) with rtx_live_ key', plan: 'ZENITH' },
    ],
    highlight: false,
  },
  {
    id: 'seo',
    icon: Zap,
    badge: 'SEO boost',
    badgeColor: 'bg-pink-500/20 text-pink-400',
    title: 'Keyword injection in replies',
    subtitle: 'Every reply supports local Google visibility.',
    description:
      'SEO boost weaves your strategic keywords (signature dishes, services, neighbourhood) naturally into AI replies. Google indexes owner responses — each reply becomes a micro-asset for local SEO.',
    vision: false,
    pulse: false,
    zenith: true,
    capabilities: [
      { icon: TrendingUp, label: 'Natural injection of configured keywords into AI replies', plan: 'ZENITH' },
      { icon: Brain, label: 'ZENITH triple judge prefers the most SEO-friendly variant', plan: 'ZENITH' },
      { icon: Globe, label: 'Aligned with Google Business owner-response indexing rules', plan: 'ZENITH' },
      { icon: BarChart2, label: 'Set priority keywords under Settings → AI DNA', plan: 'ZENITH' },
    ],
    highlight: false,
  },
  {
    id: 'reporting',
    icon: BarChart2,
    badge: 'Reporting',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
    title: 'Dashboard & monthly PDF reports',
    subtitle: 'Reputation data you can actually use.',
    description:
      'Live dashboard: rating trend, split by platform, sentiment and core KPIs. A monthly PDF is auto-generated with trends and next-month recommendations — from Vision upward.',
    vision: true,
    pulse: true,
    zenith: true,
    capabilities: [
      { icon: BarChart2, label: 'Live dashboard: average rating, volume, 12-month trend', plan: 'VISION' },
      { icon: Globe, label: 'Split by platform (Google, Facebook, Trustpilot)', plan: 'VISION' },
      { icon: FileText, label: 'Monthly auto PDF — from Vision', plan: 'VISION' },
      { icon: Brain, label: 'Sentiment breakdown by theme (service, vibe, price…)', plan: 'VISION' },
      { icon: Star, label: 'Weekly AI insights via WhatsApp (Pulse+)', plan: 'PULSE' },
    ],
    highlight: false,
  },
  {
    id: 'consultant',
    icon: MessageSquare,
    badge: 'Strategic AI consultant',
    badgeColor: 'bg-indigo-500/20 text-indigo-400',
    title: 'Your 24/7 reputation strategist',
    subtitle: 'Trained on thousands of real-world cases.',
    description:
      'The strategic consultant is a conversational agent (Claude 3.5 Sonnet + RAG on your history) inside the dashboard. It diagnoses your situation, surfaces critical trends and proposes concrete action plans.',
    vision: false,
    pulse: false,
    zenith: true,
    capabilities: [
      { icon: Brain, label: 'Claude 3.5 Sonnet + live access to your review history', plan: 'ZENITH' },
      { icon: MessageSquare, label: 'Dedicated chat under Dashboard → Consultant', plan: 'ZENITH' },
      { icon: Shield, label: 'Crisis playbooks and fraudulent-review guidance', plan: 'ZENITH' },
      { icon: TrendingUp, label: 'Prioritised action plans based on your actual data', plan: 'ZENITH' },
    ],
    highlight: false,
  },
];

export function getFeatureMatrixForLocale(locale: string): FeatureMatrixBlock[] {
  return locale === 'fr' ? FEATURES_MATRIX_FR : FEATURES_MATRIX_EN;
}
