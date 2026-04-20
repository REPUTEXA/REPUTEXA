/**
 * Contenu complet Help + Documentation (FR source + EN).
 * Puis : node scripts/sync-all-locale-messages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] =
        target[k] && typeof target[k] === 'object' && !Array.isArray(target[k]) ? target[k] : {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const HelpPageFR = {
  searchPlaceholder: 'Rechercher une question…',
  questionsCount: '{count} questions',
  supportChatTitle: 'Chat & Support',
  supportChatSub: 'Réponse en moins de 2h',
  supportChatBody:
    'Notre équipe est disponible du lundi au vendredi de 9h à 18h (CET) pour vous accompagner.',
  supportChatCta: 'Ouvrir un ticket',
  supportEmailTitle: 'Support par email',
  supportEmailSub: 'Délai moyen : 4h ouvrées',
  supportEmailBody:
    'Pour toute question technique ou demande de support, écrivez-nous directement.',
  supportEmailCta: 'Ouvrir le formulaire de contact',
  categories: [
    {
      id: 'ai',
      label: 'Intelligence Artificielle',
      faqs: [
        {
          q: "Comment l'IA génère-t-elle les réponses aux avis ?",
          a: 'REPUTEXA utilise Claude 3.5 Sonnet d\'Anthropic comme moteur principal de génération. En cas d\'indisponibilité, GPT-4o-mini d\'OpenAI prend automatiquement le relais (dual-engine avec bascule transparente). Chaque réponse applique des règles strictes : "effet miroir" (réutilisation des mots-clés de l\'avis), zéro hallucination, ton configuré dans votre ADN IA.',
        },
        {
          q: "L'IA peut-elle adapter le ton selon mon identité de marque ?",
          a: 'Oui. Dans vos paramètres d\'établissement, vous pouvez définir un "Brief de marque" : secteur, ton (formel, chaleureux, premium…), éléments de langage à éviter et mots-clés récurrents. L\'IA intègre systématiquement ces consignes dans chaque suggestion.',
        },
        {
          q: 'Les réponses sont-elles envoyées automatiquement ?',
          a: 'Oui, partiellement. Les avis positifs reçoivent une réponse automatique avec un délai humain simulé de 2 à 9 heures. Pour les avis négatifs : sur le plan VISION, la validation se fait depuis le dashboard ; sur les plans PULSE et ZENITH, l\'alerte mauvais avis est envoyée sur WhatsApp avec une suggestion de réponse que vous pouvez modifier ou publier. Une fois publiée, la réponse est placée dans une file d\'attente de 2 à 7 heures avant mise en ligne.',
        },
        {
          q: "L'IA traite-t-elle les avis dans d'autres langues ?",
          a: 'Sur le plan VISION, l\'IA répond dans la langue principale de votre établissement. Sur PULSE et ZENITH, la langue est détectée automatiquement pour chaque avis et la réponse est générée dans la même langue que l\'avis original (français, anglais, espagnol, allemand, italien, etc.).',
        },
        {
          q: "Quelle est la précision de l'analyse de toxicité ?",
          a: "Notre modèle d'analyse atteint 97,4 % de précision sur notre benchmark interne (10 000 avis annotés manuellement). Le Shield Center distingue les avis négatifs légitimes des contenus abusifs, diffamatoires ou générés artificiellement.",
        },
      ],
    },
    {
      id: 'shield',
      label: 'Shield Center',
      faqs: [
        {
          q: "Qu'est-ce que le Shield Center ?",
          a: "Le Shield Center est notre système de surveillance avancée qui analyse chaque avis reçu selon 14 indicateurs : toxicité, authenticité, intent frauduleux, sentiment, entités citées, etc. Il génère automatiquement des alertes lorsqu'un avis requiert une attention immédiate et peut signaler certains avis directement auprès de Google.",
        },
        {
          q: 'Comment fonctionne la détection des faux avis ?',
          a: "Notre algorithme croise plusieurs signaux : cohérence temporelle (pics anormaux d'avis), patterns linguistiques communs entre comptes, géolocalisation des évaluateurs, historique d'activité des profils. Un score d'authenticité est attribué à chaque avis, visible dans votre tableau de bord.",
        },
        {
          q: 'Puis-je contester un avis directement depuis REPUTEXA ?',
          a: "Le Bouclier IA prépare un dossier (motifs, formulation pour modérateurs) à coller dans le formulaire de signalement Google Business Profile. Google ne propose pas d'API publique pour supprimer un avis à votre place : l'envoi final se fait donc sur Google, après relecture de votre part.",
        },
        {
          q: 'Les alertes WhatsApp sont-elles incluses dans tous les plans ?',
          a: "Les alertes WhatsApp immédiates (avis négatifs) et le résumé hebdomadaire WhatsApp sont disponibles à partir du plan PULSE (97€/mois). Le plan VISION inclut uniquement les notifications par email. Sur ZENITH, le module AI Capture permet en plus d'inviter automatiquement vos clients à laisser un avis via WhatsApp 30 minutes après leur visite.",
        },
      ],
    },
    {
      id: 'integration',
      label: 'Intégration & API',
      faqs: [
        {
          q: 'Comment connecter mon compte Google Business Profile ?',
          a: 'Depuis votre tableau de bord → Paramètres → Plateformes, cliquez sur "Connecter Google". Une fenêtre d\'autorisation OAuth Google s\'ouvre — accordez l\'accès à la gestion de vos fiches (business.manage). La connexion s\'établit en 30 secondes et vos avis se synchronisent automatiquement. Aucune clé API manuelle n\'est requise.',
        },
        {
          q: "Quelles plateformes d'avis sont connectées ?",
          a: "REPUTEXA synchronise Google Business Profile, Facebook et Trustpilot. La connexion Google se fait via OAuth ; Facebook et Trustpilot via webhook. D'autres plateformes ne sont pas encore connectées — elles figurent dans notre feuille de route.",
        },
        {
          q: 'Puis-je connecter REPUTEXA à mon logiciel de caisse (POS) ou Zapier ?',
          a: "Oui, via le module AI Capture (exclusif ZENITH). Une clé d'intégration (rtx_live_…) est générée dans vos Paramètres → Intégrations. Elle permet à vos systèmes POS (Square, SumUp) ou des outils no-code (Zapier, Make) d'envoyer des données de visite à REPUTEXA, qui déclenche automatiquement une invitation WhatsApp 30 minutes après la visite.",
        },
        {
          q: "Combien d'établissements puis-je gérer ?",
          a: "Il n'y a pas de limite par plan sur le nombre d'établissements gérables — la tarification est déterminée par le nombre d'établissements actifs avec une remise dégressive : 1er à plein tarif, 2e à −20%, 3e à −30%, 4e à −40%, 5e et plus à −50%. Chaque établissement peut être géré depuis un tableau de bord unifié.",
        },
      ],
    },
    {
      id: 'billing',
      label: 'Facturation & Abonnement',
      faqs: [
        {
          q: 'Puis-je changer de plan à tout moment ?',
          a: "Oui. Vous pouvez upgrader ou downgrader depuis votre espace Paramètres → Abonnement. Les upgrades prennent effet immédiatement avec un calcul au prorata. Les downgrades s'appliquent à la prochaine date de renouvellement.",
        },
        {
          q: "L'essai gratuit inclut-il toutes les fonctionnalités ?",
          a: "Oui, l'essai de 14 jours vous donne accès à l'ensemble du plan ZENITH (le plus complet) sans restriction. Aucune carte bancaire n'est requise pour démarrer.",
        },
        {
          q: 'Quelle est la politique de remboursement ?',
          a: "Si vous n'êtes pas satisfait dans les 30 premiers jours suivant votre souscription, nous vous remboursons intégralement. Aucune question posée. Contactez-nous à support@reputexa.fr.",
        },
      ],
    },
    {
      id: 'stats',
      label: 'Statistiques & Rapports',
      faqs: [
        {
          q: 'Quelle est la fréquence de mise à jour des statistiques ?',
          a: "Vos avis sont importés dès réception via webhook (en temps réel). Le tableau de bord reflète toujours les données les plus récentes disponibles. Les statistiques agrégées (note moyenne, évolution) sont recalculées à chaque chargement du dashboard.",
        },
        {
          q: 'Puis-je exporter mes rapports en PDF ?',
          a: "Oui. Chaque mois, un PDF « cabinet » (stats + textes IA selon votre plan) est généré : synthèse factuelle en Vision ; analyses, sentiment et tactiques en Pulse ; couche stratégique renforcée en Zénith. Vous le recevez par e-mail et pouvez le régénérer ou le télécharger depuis le centre d'archives du dashboard. Pulse et Zénith reçoivent en plus un récap hebdomadaire sur WhatsApp.",
        },
      ],
    },
    {
      id: 'global',
      label: 'Multilingue & International',
      faqs: [
        {
          q: 'REPUTEXA fonctionne-t-il pour des établissements hors de France ?',
          a: "Oui. REPUTEXA est déployé en France, Belgique, Suisse, Espagne, Italie et Allemagne. Notre infrastructure est hébergée en Union européenne (Paris, Francfort) pour garantir la conformité RGPD dans tous les pays membres.",
        },
        {
          q: "L'interface est-elle disponible en plusieurs langues ?",
          a: "L'interface REPUTEXA est disponible en français, anglais, espagnol, allemand et italien. Vous pouvez changer la langue depuis vos paramètres ou le sélecteur en bas de page.",
        },
      ],
    },
  ],
};

const HelpPageEN = {
  searchPlaceholder: 'Search for a question…',
  questionsCount: '{count} questions',
  supportChatTitle: 'Chat & support',
  supportChatSub: 'Reply in under 2 hours',
  supportChatBody:
    'Our team is available Monday to Friday, 9am–6pm (CET), to help you.',
  supportChatCta: 'Open a ticket',
  supportEmailTitle: 'Email support',
  supportEmailSub: 'Typical response: 4 business hours',
  supportEmailBody: 'For technical questions or support requests, email us directly.',
  supportEmailCta: 'Open the contact form',
  categories: [
    {
      id: 'ai',
      label: 'Artificial intelligence',
      faqs: [
        {
          q: 'How does the AI generate review replies?',
          a: 'REPUTEXA uses Anthropic’s Claude 3.5 Sonnet as the primary generation engine. If it’s unavailable, OpenAI’s GPT-4o-mini takes over automatically (dual-engine with seamless failover). Every reply follows strict rules: “mirror effect” (reusing keywords from the review), zero hallucination, and tone from your AI DNA settings.',
        },
        {
          q: 'Can the AI match my brand voice?',
          a: 'Yes. In your establishment settings you can define a brand brief: industry, tone (formal, warm, premium…), phrases to avoid, and recurring keywords. The AI applies these instructions in every suggestion.',
        },
        {
          q: 'Are replies sent automatically?',
          a: 'Partially. Positive reviews get an automatic reply with a simulated human delay of 2–9 hours. For negative reviews: on VISION you validate from the dashboard; on PULSE and ZENITH you get a WhatsApp alert with a suggested reply you can edit or publish. Once published, the reply is queued for 2–7 hours before going live.',
        },
        {
          q: 'Does the AI handle reviews in other languages?',
          a: 'On VISION, the AI replies in your establishment’s primary language. On PULSE and ZENITH, the language is detected per review and the reply is generated in the same language as the original (French, English, Spanish, German, Italian, etc.).',
        },
        {
          q: 'How accurate is toxicity analysis?',
          a: 'Our analysis model reaches 97.4% accuracy on our internal benchmark (10,000 manually labelled reviews). Shield Center separates legitimate negative reviews from abusive, defamatory, or synthetic content.',
        },
      ],
    },
    {
      id: 'shield',
      label: 'Shield Center',
      faqs: [
        {
          q: 'What is Shield Center?',
          a: 'Shield Center is our advanced monitoring system that scores each review on 14 signals: toxicity, authenticity, fraudulent intent, sentiment, entities mentioned, and more. It raises alerts when a review needs immediate attention and can help you prepare reports for Google.',
        },
        {
          q: 'How does fake-review detection work?',
          a: 'We combine several signals: temporal patterns (unusual spikes), linguistic patterns across accounts, reviewer geolocation, and profile history. Each review gets an authenticity score visible in your dashboard.',
        },
        {
          q: 'Can I dispute a review from REPUTEXA?',
          a: 'Shield prepares a case (grounds and wording for moderators) to paste into Google Business Profile’s reporting flow. Google offers no public API to remove a review on your behalf—the final submission is always on Google after your review.',
        },
        {
          q: 'Are WhatsApp alerts included on every plan?',
          a: 'Instant WhatsApp alerts for negative reviews and the weekly WhatsApp digest start on PULSE (€97/mo). VISION includes email notifications only. On ZENITH, AI Capture can also send a WhatsApp invite 30 minutes after a visit.',
        },
      ],
    },
    {
      id: 'integration',
      label: 'Integration & API',
      faqs: [
        {
          q: 'How do I connect Google Business Profile?',
          a: 'From your dashboard → Settings → Platforms, click “Connect Google”. An OAuth window opens—grant access to manage your listings (business.manage). Connection takes about 30 seconds and reviews sync automatically. No manual API key is required.',
        },
        {
          q: 'Which review platforms are supported?',
          a: 'REPUTEXA syncs Google Business Profile, Facebook, and Trustpilot. Google uses OAuth; Facebook and Trustpilot use webhooks. Other platforms are on our roadmap.',
        },
        {
          q: 'Can I connect a POS or Zapier?',
          a: 'Yes, via AI Capture (ZENITH only). An inbound key (rtx_live_…) is generated under Settings → Integrations. Your POS (Square, SumUp) or no-code tools (Zapier, Make) can send visit data so REPUTEXA triggers a WhatsApp invite 30 minutes after the visit.',
        },
        {
          q: 'How many locations can I manage?',
          a: 'There is no per-plan cap on locations—pricing scales with active locations using tiered discounts: 1st at full price, 2nd −20%, 3rd −30%, 4th −40%, 5+ −50%. All locations are managed from one dashboard.',
        },
      ],
    },
    {
      id: 'billing',
      label: 'Billing & subscription',
      faqs: [
        {
          q: 'Can I change plans anytime?',
          a: 'Yes. Upgrade or downgrade under Settings → Subscription. Upgrades apply immediately with proration. Downgrades apply at the next renewal.',
        },
        {
          q: 'Does the free trial include everything?',
          a: 'Yes—the 14-day trial unlocks the full ZENITH plan with no restrictions. No card required to start.',
        },
        {
          q: 'What is your refund policy?',
          a: 'If you are not satisfied within the first 30 days after subscribing, we refund in full—no questions asked. Contact support@reputexa.fr.',
        },
      ],
    },
    {
      id: 'stats',
      label: 'Statistics & reports',
      faqs: [
        {
          q: 'How often are statistics updated?',
          a: 'Reviews are ingested as they arrive via webhook (near real-time). The dashboard always reflects the latest data. Aggregates (average rating, trends) refresh when you load the dashboard.',
        },
        {
          q: 'Can I export PDF reports?',
          a: 'Yes. Each month a “cabinet-style” PDF (stats + AI narrative by plan) is generated: factual summary on Vision; analysis, sentiment, and tactics on Pulse; deeper strategy on Zenith. You receive it by email and can regenerate or download it from the dashboard archive. Pulse and Zenith also get a weekly WhatsApp recap.',
        },
      ],
    },
    {
      id: 'global',
      label: 'Multilingual & international',
      faqs: [
        {
          q: 'Does REPUTEXA work outside France?',
          a: 'Yes. REPUTEXA operates in France, Belgium, Switzerland, Spain, Italy, and Germany. Infrastructure is hosted in the EU (Paris, Frankfurt) for GDPR-aligned processing.',
        },
        {
          q: 'Is the UI available in several languages?',
          a: 'The REPUTEXA UI is available in French, English, Spanish, German, and Italian. Change language in your settings or via the footer selector.',
        },
      ],
    },
  ],
};

const posBlockFR = `POST https://reputexa.fr/api/webhooks/{votre_cle_rtx_live}

Content-Type: application/json

{
  "customerName": "Marie Dupont",
  "phone": "+33612345678",
  "visitDate": "2026-03-22T14:30:00Z",
  "establishmentId": "votre_etablissement_id"
}

// REPUTEXA programme automatiquement un message WhatsApp
// 30 minutes après la visite pour inviter au dépôt d'avis.
// Fonctionnalité exclusive ZENITH (AI Capture).`;

const posBlockEN = `POST https://reputexa.fr/api/webhooks/{your_rtx_live_key}

Content-Type: application/json

{
  "customerName": "Jane Doe",
  "phone": "+14155552671",
  "visitDate": "2026-03-22T14:30:00Z",
  "establishmentId": "your_establishment_id"
}

// REPUTEXA automatically schedules a WhatsApp message
// 30 minutes after the visit to invite a review.
// ZENITH-only feature (AI Capture).`;

const DocumentationPageFR = {
  onboardingTitle: 'Démarrage en 5 étapes',
  onboardingBadge: '≈ 10 minutes',
  onboardingSteps: [
    {
      number: '01',
      title: 'Créer votre compte',
      description:
        'Renseignez les informations de votre établissement : nom, type, adresse, numéro WhatsApp et email. Un code de vérification est envoyé immédiatement à votre adresse email.',
      detail:
        "La validation Cloudflare Turnstile protège l'inscription contre les bots. Le numéro de téléphone doit être au format international (ex : +33612345678).",
    },
    {
      number: '02',
      title: 'Vérifier votre email',
      description:
        "Ouvrez l'email reçu et saisissez le code à 6 chiffres sur la page de vérification. Ce code est valable 15 minutes.",
      detail:
        "Si vous ne recevez pas l'email, vérifiez vos spams. Vous pouvez demander un nouveau code depuis la page /verify.",
    },
    {
      number: '03',
      title: 'Connecter Google Business Profile',
      description:
        'Dans votre tableau de bord → Paramètres → Plateformes, cliquez sur "Connecter Google". Une fenêtre OAuth Google s\'ouvre — autorisez l\'accès à la gestion de vos fiches. Vos avis sont synchronisés automatiquement.',
      detail:
        "REPUTEXA demande uniquement l'autorisation business.manage. Aucun accès à votre compte Google personnel n'est requis.",
    },
    {
      number: '04',
      title: 'Configurer votre ADN IA',
      description:
        'Dans Paramètres → ADN IA, définissez le ton (professionnel, chaleureux, luxueux, décontracté), la longueur des réponses et vos instructions spécifiques. L\'IA génère une simulation en temps réel.',
      detail:
        'Sur le plan ZENITH, le système Triple Juge génère 3 variantes (empathie, storytelling, expertise) et sélectionne automatiquement la meilleure.',
    },
    {
      number: '05',
      title: 'Activer les alertes WhatsApp',
      description:
        'Dans Paramètres → Notifications, renseignez votre numéro WhatsApp et définissez le seuil d\'alerte (ex : avis ≤ 3 étoiles). Vous recevrez chaque mauvais avis directement sur WhatsApp avec la réponse IA suggérée.',
      detail:
        'Disponible sur PULSE et ZENITH. Les alertes sont envoyées via Twilio avec des boutons interactifs pour approuver ou modifier la réponse directement depuis WhatsApp.',
    },
  ],
  whatsappTitle: 'Flux de traitement automatique',
  whatsappIntro:
    "Dès qu'un avis négatif est détecté, REPUTEXA déclenche automatiquement ce pipeline — aucune action de votre part n'est requise.",
  whatsappFlow: [
    {
      step: 'Avis négatif reçu',
      detail: 'Un client laisse un avis ≤ 3 étoiles sur Google, Facebook ou Trustpilot.',
    },
    {
      step: 'Analyse Shield Center',
      detail:
        "L'IA analyse la toxicité (haine, spam, conflit d'intérêt, doxxing) et génère un score d'authenticité.",
    },
    {
      step: 'Génération IA (Claude 3.5 Sonnet)',
      detail: "Une réponse contextualisée est générée automatiquement, respectant votre ADN IA configuré.",
    },
    {
      step: 'Alerte WhatsApp',
      detail:
        "Vous recevez le résumé de l'avis + la réponse suggérée avec 2 boutons : Approuver ou Modifier.",
    },
    {
      step: 'Publication avec délai humain',
      detail:
        "Si approuvée, la réponse est publiée avec un délai simulé (2–7h) pour un rendu naturel. Le Shield Center génère un rapport de contestation si l'avis est frauduleux.",
    },
  ],
  platformsTitle: 'Plateformes connectées',
  colPlatform: 'Plateforme',
  colProtocol: 'Protocole',
  colAvailability: 'Disponibilité',
  platformsRows: [
    {
      name: 'Google Business Profile',
      status: 'OAuth 2.0 (business.manage)',
      available: 'Tous les plans',
    },
    { name: 'Facebook', status: 'Synchronisation webhook', available: 'Tous les plans' },
    { name: 'Trustpilot', status: 'Synchronisation webhook', available: 'Tous les plans' },
  ],
  platformsFootnote:
    "La connexion Google utilise uniquement l'autorisation business.manage — aucun accès à votre compte Google personnel.",
  posTitle: 'Intégration POS & Zapier',
  posBadge: 'Exclusif ZENITH',
  posIntro:
    "REPUTEXA génère une clé d'API d'entrée (rtx_live_…) visible dans vos Paramètres. Elle permet à vos systèmes externes (logiciel de caisse, Zapier, Make) d'envoyer des données de visite à REPUTEXA, qui déclenche automatiquement le module AI Capture — un message WhatsApp envoyé au client 30 minutes après sa visite pour l'inviter à laisser un avis.",
  posWebhookLabel: 'Webhook entrant — données de visite POS',
  posKeyNote:
    "Cette clé est pour les webhooks entrants (données vers REPUTEXA). Elle n'est pas utilisée pour lire vos avis ou vos statistiques via une API externe.",
  posCodeBlock: posBlockFR,
  keysTitle: "Où trouver vos clés d'intégration",
  keysCards: [
    {
      label: 'Clé API entrante (POS/Zapier)',
      path: 'Paramètres → Intégrations → Clé API',
      plan: 'ZENITH',
    },
    {
      label: 'Numéro WhatsApp pour alertes',
      path: 'Paramètres → Notifications → WhatsApp',
      plan: 'PULSE+',
    },
    {
      label: 'Connexion Google Business',
      path: 'Paramètres → Plateformes → Google',
      plan: 'Tous',
    },
  ],
  practicesTitle: 'Bonnes pratiques',
  practices: [
    'Configurez votre ADN IA (ton + instructions) avant de recevoir vos premiers avis pour que les suggestions soient immédiatement calibrées.',
    "Activez les alertes WhatsApp sur votre numéro personnel ou professionnel — c'est le canal le plus rapide pour traiter un avis en urgence.",
    "Pour le webhook POS, envoyez les données de visite dans les 10 minutes après le départ du client, pas plus tard — le délai 30min de l'AI Capture est calculé depuis la réception du webhook.",
    "Ne partagez jamais votre clé rtx_live_ publiquement. Elle est liée à votre compte et régit la facturation de vos activations AI Capture.",
    "Le Shield Center analyse automatiquement chaque avis reçu — aucune configuration nécessaire. Consultez le tableau de bord Alertes pour les cas critiques.",
    'En cas de réponse IA incorrecte via WhatsApp, utilisez le bouton "Modifier" — votre correction est mémorisée pour améliorer les prochaines suggestions.',
  ],
  ctaTitle: 'Prêt à démarrer ?',
  ctaBody:
    'Accès complet ZENITH pendant 14 jours, sans carte bancaire. Votre premier avis IA est généré en moins de 60 secondes après connexion de Google.',
  ctaTrial: 'Créer mon compte gratuitement',
  ctaHelp: "Centre d'aide",
};

const DocumentationPageEN = {
  onboardingTitle: 'Get started in 5 steps',
  onboardingBadge: '≈ 10 minutes',
  onboardingSteps: [
    {
      number: '01',
      title: 'Create your account',
      description:
        'Enter your business details: name, type, address, WhatsApp number, and email. A verification code is sent to your inbox immediately.',
      detail:
        'Cloudflare Turnstile protects signup from bots. Phone numbers must be in international format (e.g. +33612345678).',
    },
    {
      number: '02',
      title: 'Verify your email',
      description:
        'Open the email and enter the 6-digit code on the verification page. The code is valid for 15 minutes.',
      detail:
        'If you do not see the email, check spam. You can request a new code from the /verify page.',
    },
    {
      number: '03',
      title: 'Connect Google Business Profile',
      description:
        'In your dashboard → Settings → Platforms, click “Connect Google”. An OAuth window opens—grant access to manage your listings. Reviews sync automatically.',
      detail:
        'REPUTEXA only requests the business.manage scope. No access to your personal Google account is required.',
    },
    {
      number: '04',
      title: 'Configure your AI DNA',
      description:
        'Under Settings → AI DNA, set tone (professional, warm, luxury, casual), reply length, and custom instructions. The AI shows a live preview.',
      detail:
        'On ZENITH, Triple Judge generates 3 variants (empathy, storytelling, expertise) and picks the best one automatically.',
    },
    {
      number: '05',
      title: 'Enable WhatsApp alerts',
      description:
        'Under Settings → Notifications, add your WhatsApp number and set an alert threshold (e.g. reviews ≤ 3 stars). Each negative review arrives on WhatsApp with a suggested AI reply.',
      detail:
        'Available on PULSE and ZENITH. Alerts are sent via Twilio with interactive buttons to approve or edit the reply from WhatsApp.',
    },
  ],
  whatsappTitle: 'Automatic processing flow',
  whatsappIntro:
    'Whenever a negative review is detected, REPUTEXA runs this pipeline automatically—no action required on your side.',
  whatsappFlow: [
    {
      step: 'Negative review received',
      detail: 'A customer leaves a review ≤ 3 stars on Google, Facebook, or Trustpilot.',
    },
    {
      step: 'Shield Center analysis',
      detail:
        'The AI scores toxicity (hate, spam, conflict of interest, doxxing) and computes an authenticity score.',
    },
    {
      step: 'AI generation (Claude 3.5 Sonnet)',
      detail: 'A contextual reply is generated automatically, following your AI DNA settings.',
    },
    {
      step: 'WhatsApp alert',
      detail:
        'You receive the review summary plus the suggested reply with two buttons: Approve or Edit.',
    },
    {
      step: 'Publish with human-like delay',
      detail:
        'If approved, the reply is published after a simulated 2–7h delay for a natural cadence. Shield can prepare a dispute brief if the review looks fraudulent.',
    },
  ],
  platformsTitle: 'Connected platforms',
  colPlatform: 'Platform',
  colProtocol: 'Protocol',
  colAvailability: 'Availability',
  platformsRows: [
    {
      name: 'Google Business Profile',
      status: 'OAuth 2.0 (business.manage)',
      available: 'All plans',
    },
    { name: 'Facebook', status: 'Webhook sync', available: 'All plans' },
    { name: 'Trustpilot', status: 'Webhook sync', available: 'All plans' },
  ],
  platformsFootnote:
    'Google connection uses only the business.manage scope—no access to your personal Google account.',
  posTitle: 'POS & Zapier integration',
  posBadge: 'ZENITH only',
  posIntro:
    'REPUTEXA issues an inbound API key (rtx_live_…) under Settings. Your POS (Square, SumUp) or no-code tools (Zapier, Make) can POST visit data so REPUTEXA triggers AI Capture—a WhatsApp message 30 minutes after the visit inviting a review.',
  posWebhookLabel: 'Inbound webhook — POS visit payload',
  posKeyNote:
    'This key is for inbound webhooks (data into REPUTEXA). It is not used to read reviews or analytics from an external API.',
  posCodeBlock: posBlockEN,
  keysTitle: 'Where to find your integration keys',
  keysCards: [
    {
      label: 'Inbound API key (POS/Zapier)',
      path: 'Settings → Integrations → API key',
      plan: 'ZENITH',
    },
    {
      label: 'WhatsApp number for alerts',
      path: 'Settings → Notifications → WhatsApp',
      plan: 'PULSE+',
    },
    {
      label: 'Google Business connection',
      path: 'Settings → Platforms → Google',
      plan: 'All',
    },
  ],
  practicesTitle: 'Best practices',
  practices: [
    'Configure AI DNA (tone + instructions) before your first reviews so suggestions are calibrated from day one.',
    'Enable WhatsApp alerts on a number you monitor—it is the fastest channel for urgent reviews.',
    'For the POS webhook, send visit data within 10 minutes after the customer leaves—the 30-minute AI Capture timer starts when we receive the payload.',
    'Never share your rtx_live_ key publicly—it is tied to your account and AI Capture usage.',
    'Shield Center analyzes every incoming review automatically—no setup required. Use the Alerts dashboard for critical cases.',
    'If a WhatsApp AI reply is wrong, tap “Edit”—your correction helps improve future suggestions.',
  ],
  ctaTitle: 'Ready to start?',
  ctaBody:
    'Full ZENITH access for 14 days, no card required. Your first AI reply is generated within 60 seconds after Google is connected.',
  ctaTrial: 'Create my free account',
  ctaHelp: 'Help center',
};

const frPath = path.join(messagesDir, 'fr.json');
const enPath = path.join(messagesDir, 'en.json');
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
fr.HelpPage = HelpPageFR;
en.HelpPage = HelpPageEN;
fr.DocumentationPage = DocumentationPageFR;
en.DocumentationPage = DocumentationPageEN;
fs.writeFileSync(frPath, JSON.stringify(fr));
fs.writeFileSync(enPath, JSON.stringify(en));
console.log('Wrote HelpPage + DocumentationPage to fr.json and en.json');
