import { formatPlanAmountForLocale } from '@/lib/i18n/pricing-message-format';

export type NewsItem = {
  id: string;
  type: 'press' | 'product' | 'milestone';
  badge: string;
  date: string;
  title: string;
  excerpt: string;
  featured?: boolean;
};

export type NewsPublicContent = {
  items: NewsItem[];
  filterAll: string;
  filterProduct: string;
  filterPress: string;
  filterMilestones: string;
  featuredLabel: string;
  readMore: string;
  pressTitle: string;
  pressBody: string;
  pressCta: string;
};

const FR: NewsPublicContent = {
  items: [
    {
      id: 'zenith-launch-2026',
      type: 'product',
      badge: 'Nouveau produit',
      date: '18 mars 2026',
      title: 'Lancement du plan ZENITH : la gestion de réputation sans compromis',
      excerpt:
        'REPUTEXA franchit une nouvelle étape avec ZENITH, son offre la plus complète. Au programme : Claude 3.5 Sonnet, Shield Center de dernière génération, consultant stratégique intégré, AI Capture (invitation WhatsApp après visite) et rapports PDF mensuels. Disponible dès maintenant à 179€/mois.',
      featured: true,
    },
    {
      id: 'shield-center-v2',
      type: 'product',
      badge: 'Mise à jour majeure',
      date: '5 mars 2026',
      title: 'Shield Center v2 : détection de faux avis à 97,4% de précision',
      excerpt:
        "Notre moteur d'analyse de toxicité intègre désormais 14 indicateurs comportementaux et linguistiques. La nouvelle version détecte les campagnes de faux avis coordonnées avec une précision de 97,4% sur notre benchmark, et génère automatiquement des rapports de contestation Google.",
    },
    {
      id: 'expansion-europe-2026',
      type: 'milestone',
      badge: 'Expansion',
      date: '20 février 2026',
      title: "REPUTEXA s'étend en Espagne, Italie et Allemagne",
      excerpt:
        'Fort de sa croissance en France et en Belgique, REPUTEXA ouvre officiellement ses services aux marchés espagnol, italien et allemand. La plateforme est désormais disponible en 5 langues avec un support client localisé dans chaque pays.',
    },
    {
      id: 'partenariat-google-api',
      type: 'press',
      badge: 'Communiqué de presse',
      date: '10 février 2026',
      title: "REPUTEXA intègre l'API Google Business Profile v4.2",
      excerpt:
        'La mise à jour de notre connecteur Google permet désormais une synchronisation en temps réel des avis, une meilleure gestion des photos et l\'accès aux données Q&A. Cette intégration profonde renforce encore notre position de leader en matière de gestion d\'e-réputation IA.',
    },
    {
      id: 'rapport-reputation-ia-2026',
      type: 'press',
      badge: 'Publication',
      date: '28 janvier 2026',
      title: 'Publication du rapport "E-réputation & IA 2026" — 2 400 établissements analysés',
      excerpt:
        "REPUTEXA publie son premier rapport annuel sur l'état de l'e-réputation en France. Nos données révèlent qu'un établissement ayant une note Google supérieure à 4,5 étoiles génère en moyenne 34% de revenus supplémentaires. Téléchargement gratuit sur demande.",
    },
    {
      id: 'api-v1-launch',
      type: 'product',
      badge: 'Lancement API',
      date: '15 janvier 2026',
      title: "Ouverture de l'API REPUTEXA v1 aux développeurs",
      excerpt:
        'Notre API REST est désormais en accès général. Clés de production disponibles depuis le dashboard, documentation complète en ligne, SDK Node.js et Python disponibles. Rate limiting adapté à chaque plan pour une intégration flexible.',
    },
    {
      id: 'soc2-audit',
      type: 'milestone',
      badge: 'Sécurité',
      date: '3 janvier 2026',
      title: "Lancement de l'audit SOC 2 Type II — partenariat avec Vanta",
      excerpt:
        "REPUTEXA initie son premier audit SOC 2 Type II en partenariat avec Vanta, la plateforme de conformité de référence. Les résultats sont attendus pour T3 2026. Cette démarche s'inscrit dans notre engagement pour des standards de sécurité de niveau entreprise.",
    },
    {
      id: 'whatsapp-alerts',
      type: 'product',
      badge: 'Fonctionnalité',
      date: '12 décembre 2025',
      title: 'Alertes WhatsApp en temps réel pour les avis critiques',
      excerpt:
        "Les utilisateurs PULSE et ZENITH reçoivent désormais des notifications WhatsApp instantanées pour chaque avis 1 ou 2 étoiles. L'alerte inclut le texte de l'avis, le score de toxicité et un lien direct vers la suggestion de réponse IA.",
    },
  ],
  filterAll: 'Tout',
  filterProduct: 'Produit',
  filterPress: 'Presse',
  filterMilestones: 'Jalons',
  featuredLabel: 'À la une',
  readMore: 'En savoir plus',
  pressTitle: 'Relations presse',
  pressBody:
    'Vous êtes journaliste ou blogueur ? Notre équipe communication vous fournit les éléments de langage, visuels et données nécessaires à vos publications.',
  pressCta: 'Demander le kit média',
};

const EN: NewsPublicContent = {
  items: [
    {
      id: 'zenith-launch-2026',
      type: 'product',
      badge: 'New product',
      date: 'Mar 18, 2026',
      title: 'ZENITH plan launch: reputation management without compromise',
      excerpt:
        'REPUTEXA reaches its next milestone with ZENITH, our most complete tier: Claude 3.5 Sonnet, next-gen Shield Center, built-in strategy consultant, AI Capture (post-visit WhatsApp invites), and monthly PDF reports. Available now from €179/month.',
      featured: true,
    },
    {
      id: 'shield-center-v2',
      type: 'product',
      badge: 'Major update',
      date: 'Mar 5, 2026',
      title: 'Shield Center v2: 97.4% precision fake-review detection',
      excerpt:
        'Our toxicity engine now scores 14 behavioural and linguistic signals. v2 spots coordinated fake-review campaigns at 97.4% precision on our benchmark and auto-builds Google dispute packs.',
    },
    {
      id: 'expansion-europe-2026',
      type: 'milestone',
      badge: 'Expansion',
      date: 'Feb 20, 2026',
      title: 'REPUTEXA expands to Spain, Italy, and Germany',
      excerpt:
        'After strong growth in France and Belgium, REPUTEXA is officially available in Spain, Italy, and Germany. The product ships in five languages with localized support in each market.',
    },
    {
      id: 'partenariat-google-api',
      type: 'press',
      badge: 'Press release',
      date: 'Feb 10, 2026',
      title: 'REPUTEXA adopts Google Business Profile API v4.2',
      excerpt:
        'Our Google connector now supports near real-time review sync, richer photo handling, and Q&A data—deepening our lead in AI-powered reputation management.',
    },
    {
      id: 'rapport-reputation-ia-2026',
      type: 'press',
      badge: 'Publication',
      date: 'Jan 28, 2026',
      title: '"Reputation & AI 2026" report — 2,400 businesses analysed',
      excerpt:
        'Our first annual report on reputation in France shows venues above 4.5★ drive roughly 34% more revenue on average. Free copy on request.',
    },
    {
      id: 'api-v1-launch',
      type: 'product',
      badge: 'API launch',
      date: 'Jan 15, 2026',
      title: 'REPUTEXA API v1 is generally available',
      excerpt:
        'Production keys live in the dashboard, full docs online, Node.js and Python SDKs, and plan-aware rate limits for flexible integrations.',
    },
    {
      id: 'soc2-audit',
      type: 'milestone',
      badge: 'Security',
      date: 'Jan 3, 2026',
      title: 'SOC 2 Type II audit kicks off with Vanta',
      excerpt:
        'We are running our first SOC 2 Type II with Vanta; results expected Q3 2026—part of our enterprise-grade security roadmap.',
    },
    {
      id: 'whatsapp-alerts',
      type: 'product',
      badge: 'Feature',
      date: 'Dec 12, 2025',
      title: 'Real-time WhatsApp alerts for critical reviews',
      excerpt:
        'PULSE and ZENITH users get instant WhatsApp pings for 1–2★ reviews, including text, toxicity score, and a deep link to the AI reply draft.',
    },
  ],
  filterAll: 'All',
  filterProduct: 'Product',
  filterPress: 'Press',
  filterMilestones: 'Milestones',
  featuredLabel: 'Featured',
  readMore: 'Learn more',
  pressTitle: 'Press',
  pressBody:
    'Journalist or blogger? Our comms team can share messaging, visuals, and data for your story.',
  pressCta: 'Request the media kit',
};

const ZENITH_LAUNCH_ID = 'zenith-launch-2026';

export function getNewsPublicContent(locale: string): NewsPublicContent {
  const base = locale === 'fr' ? FR : EN;
  const zenithMo = formatPlanAmountForLocale(locale, 'zenith', { monthly: true });
  const items = base.items.map((item) => {
    if (item.id !== ZENITH_LAUNCH_ID) return item;
    const excerpt =
      locale === 'fr'
        ? item.excerpt.replace(/Disponible dès maintenant à [^.]+\./, `Disponible dès maintenant à ${zenithMo}.`)
        : item.excerpt.replace(/Available now from [^.]+\./, `Available now from ${zenithMo}.`);
    return { ...item, excerpt };
  });
  return { ...base, items };
}
