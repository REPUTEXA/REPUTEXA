/**
 * Sitemap, blog index, guides index, guides slug bodies, newsletter form, blog article chrome, HomePage.brandAria.
 * Run: node scripts/merge-public-surface-i18n.mjs && node scripts/sync-all-locale-messages.mjs
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

const patchFR = {
  PublicPages: {
    sitemapSections: [
      {
        title: 'Produit',
        links: [
          { href: '/', label: 'Accueil' },
          { href: '/#fonctionnalités', label: 'Fonctionnalités' },
          { href: '/#pricing', label: 'Tarifs' },
          { href: '/#témoignages', label: 'Avis clients' },
          { href: '/#faq', label: 'FAQ' },
          { href: '/pricing', label: 'Page Tarifs' },
          { href: '/login', label: 'Connexion' },
          { href: '/signup?mode=trial', label: 'Essai gratuit' },
        ],
      },
      {
        title: 'Ressources',
        links: [
          { href: '/blog', label: 'Blog' },
          { href: '/guides', label: 'Guides' },
          { href: '/api', label: 'API' },
          { href: '/statuts', label: 'Statuts' },
        ],
      },
      {
        title: 'Entreprise',
        links: [
          { href: '/about', label: 'À propos' },
          { href: '/careers', label: 'Carrières' },
          { href: '/investors', label: 'Investisseurs' },
          { href: '/sustainability', label: 'Développement durable' },
        ],
      },
      {
        title: 'Légal & Support',
        links: [
          { href: '/contact', label: 'Contact' },
          { href: '/legal/mentions-legales', label: 'Mentions légales' },
          { href: '/legal/confidentialite', label: 'Confidentialité' },
          { href: '/legal/cgu', label: 'CGU' },
        ],
      },
    ],
  },
  BlogPage: {
    featuredBadge: 'À la une',
    readArticle: "Lire l'article",
    readMore: 'Lire',
    categories: {
      all: 'Tous',
      product: 'Produit',
      trends: 'Tendances',
      regulation: 'Réglementation',
      guide: 'Guide pratique',
      useCase: "Cas d'usage",
      seoLocal: 'SEO Local',
      cybersecurity: 'Cybersécurité',
      studies: 'Études',
      international: 'International',
    },
    categoryFilters: [
      { key: 'all', label: 'Tous' },
      { key: 'product', label: 'Produit' },
      { key: 'trends', label: 'Tendances' },
      { key: 'regulation', label: 'Réglementation' },
      { key: 'guide', label: 'Guide pratique' },
      { key: 'useCase', label: "Cas d'usage" },
      { key: 'seoLocal', label: 'SEO Local' },
      { key: 'cybersecurity', label: 'Cybersécurité' },
      { key: 'studies', label: 'Études' },
      { key: 'international', label: 'International' },
    ],
    posts: [
      {
        slug: 'shield-center-faux-avis-google-2026',
        title:
          'Comment le Shield Center de REPUTEXA détecte les faux avis avec 97,4% de précision',
        excerpt:
          'Derrière notre algorithme de détection de faux avis : les 14 indicateurs comportementaux et linguistiques que nous analysons en temps réel sur chaque avis reçu.',
        date: '19 mars 2026',
        readTime: '8 min',
        categoryKey: 'product',
        featured: true,
      },
      {
        slug: 'gestion-avis-google-2026',
        title: 'Gestion des avis Google en 2026 : les 5 tendances à surveiller',
        excerpt:
          "IA générative, DSA, nouveaux formats d'avis, l'écosystème Google Reviews évolue rapidement. Ce que chaque commerçant doit savoir pour ne pas se laisser dépasser.",
        date: '15 mars 2026',
        readTime: '6 min',
        categoryKey: 'trends',
      },
      {
        slug: 'dsa-faux-avis-obligations-2026',
        title: 'DSA 2026 : ce que le Digital Services Act change pour les avis en ligne',
        excerpt:
          "Le DSA impose de nouvelles obligations aux plateformes d'avis. Ce que ça change concrètement pour les établissements et comment REPUTEXA vous aide à être conforme.",
        date: '10 mars 2026',
        readTime: '5 min',
        categoryKey: 'regulation',
      },
      {
        slug: 'repondre-avis-negatifs',
        title:
          'Comment répondre aux avis négatifs sans perdre votre sang-froid — et votre réputation',
        excerpt:
          "Un guide pratique avec des templates validés pour transformer une mauvaise review en opportunité de fidélisation. Inclut 12 formulations à éviter absolument.",
        date: '8 mars 2026',
        readTime: '7 min',
        categoryKey: 'guide',
      },
      {
        slug: 'ia-reputation-restauration',
        title: "L'IA au service de votre réputation : 5 cas d'usage concrets en restauration",
        excerpt:
          "Retours d'expérience de restaurateurs qui ont automatisé leurs réponses aux avis et gagné jusqu'à 8 heures par semaine. Données réelles, résultats mesurés.",
        date: '1er mars 2026',
        readTime: '9 min',
        categoryKey: 'useCase',
      },
      {
        slug: 'seo-local-avis-google',
        title: 'Comment vos avis Google impactent directement votre SEO local en 2026',
        excerpt:
          'Fréquence de réponse, richesse sémantique, volume et fraîcheur des avis : les 6 facteurs qui influencent votre classement dans le Local Pack Google selon nos données.',
        date: '22 février 2026',
        readTime: '6 min',
        categoryKey: 'seoLocal',
      },
      {
        slug: 'cybersecurite-reputation-marque',
        title: 'E-réputation & cybersécurité : comment protéger votre marque des attaques numériques',
        excerpt:
          "Les campagnes de dénigrement coordonnées, les review bombing et l'astroturfing sont des formes d'attaques cyber contre lesquelles votre réputation a besoin d'une protection active.",
        date: '14 février 2026',
        readTime: '8 min',
        categoryKey: 'cybersecurity',
      },
      {
        slug: 'note-google-4-5-impact-revenu',
        title: "+34% de revenus : l'impact financier d'une note Google ≥ 4,5 étoiles",
        excerpt:
          "Notre analyse de 3 200 établissements révèle une corrélation directe entre la note Google et les revenus. Les chiffres qui devraient convaincre n'importe quel dirigeant d'investir dans sa réputation.",
        date: '5 février 2026',
        readTime: '5 min',
        categoryKey: 'studies',
      },
      {
        slug: 'multilingue-reponses-avis-europe',
        title: 'Gérer vos avis en 9 langues : le défi de la réputation internationale',
        excerpt:
          'Comment REPUTEXA gère les nuances culturelles et linguistiques des avis multi-langues pour générer des réponses authentiques qui résonnent avec chaque audience.',
        date: '28 janvier 2026',
        readTime: '4 min',
        categoryKey: 'international',
      },
    ],
  },
  SubscribeForm: {
    successTitle: 'Accès configuré.',
    successBody: 'Vous recevrez nos analyses flash dès mardi prochain.',
    title: 'Restez informé',
    description:
      "Recevez nos analyses flash sur l'IA, l'e-réputation et la cybersécurité — chaque mardi, directement dans votre boîte mail.",
    placeholder: 'vous@exemple.com',
    submit: "S'inscrire",
    errorGeneric: 'Une erreur est survenue. Réessayez.',
    errorNetwork: 'Erreur réseau. Vérifiez votre connexion et réessayez.',
    footerNote: 'Sans spam · Désabonnement en un clic · Données hébergées en EU',
  },
  BlogArticle: {
    backToBlog: 'Retour au blog',
    readTimeSuffix: 'de lecture',
    updatedPrefix: 'Mis à jour :',
    conclusionTitle: 'Conclusion',
    ctaLead: "Prêt à passer à l'action ?",
    ctaButton: 'Essai gratuit 14 jours',
    sourcesTitle: 'Sources & Références',
    methodologyNote: 'Note méthodologique',
    methodologyDisclaimer:
      "Les données propriétaires REPUTEXA sont issues de l'analyse de fiches Google Business Profile de clients actifs, sous accord de confidentialité. Les statistiques tierces sont citées avec leur source primaire.",
    relatedTitle: 'Articles connexes',
    categories: {
      product: 'Produit',
      trends: 'Tendances',
      regulation: 'Réglementation',
      guide: 'Guide pratique',
      useCase: "Cas d'usage",
      seoLocal: 'SEO Local',
      cybersecurity: 'Cybersécurité',
      studies: 'Études',
      international: 'International',
    },
  },
  GuidesPage: {
    stats: [
      { value: '8', label: 'Guides disponibles' },
      { value: '3', label: 'Niveaux de difficulté' },
      { value: '91 min', label: 'De contenu total' },
    ],
    featuredBadge: 'Recommandé pour commencer',
    readGuide: 'Lire le guide',
    ctaTitle: "Besoin d'un accompagnement personnalisé ?",
    ctaBody:
      'Notre équipe et le Consultant IA Stratégique (ZENITH) peuvent vous accompagner sur votre cas spécifique.',
    ctaTrial: 'Essai gratuit',
    ctaHelp: "Centre d'aide",
    levels: {
      beginner: 'Débutant',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé',
    },
    categoryFilters: [
      { key: 'all', label: 'Tous' },
      { key: 'firstSteps', label: 'Premiers pas' },
      { key: 'strategy', label: 'Stratégie' },
      { key: 'ai', label: 'IA & Personnalisation' },
      { key: 'compliance', label: 'Conformité' },
      { key: 'shield', label: 'Shield Center' },
      { key: 'multi', label: 'Multi-plateformes' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'api', label: 'API & Intégrations' },
    ],
    guides: [
      {
        slug: 'demarrage-rapide',
        icon: 'zap',
        title: 'Démarrage rapide : REPUTEXA en 5 minutes',
        description:
          "Créez votre compte, connectez votre fiche Google Business Profile et recevez vos premières suggestions de réponses IA. Tout ce qu'il faut pour être opérationnel immédiatement.",
        readTime: '5 min',
        levelKey: 'beginner',
        categoryKey: 'firstSteps',
        featured: true,
      },
      {
        slug: 'optimiser-notation',
        icon: 'barChart2',
        title: 'Optimiser sa notation Google : guide stratégique complet',
        description:
          'De 3,8 à 4,7 étoiles en 6 mois — les stratégies éprouvées pour augmenter votre note moyenne, maximiser le volume d\'avis positifs et corriger les points critiques identifiés.',
        readTime: '12 min',
        levelKey: 'intermediate',
        categoryKey: 'strategy',
      },
      {
        slug: 'reponses-ia-personnalisees',
        icon: 'messageSquare',
        title: 'Personnaliser les réponses IA selon votre identité de marque',
        description:
          'Comment configurer votre Brief de marque pour que chaque réponse IA reflète parfaitement votre ton, vos valeurs et votre style. Inclut des exemples par secteur.',
        readTime: '8 min',
        levelKey: 'intermediate',
        categoryKey: 'ai',
      },
      {
        slug: 'conformite-rgpd',
        icon: 'shield',
        title: 'Conformité RGPD et gestion des avis clients',
        description:
          'Bonnes pratiques pour traiter les données personnelles dans vos avis et réponses, tout en restant pleinement conforme au cadre réglementaire européen.',
        readTime: '10 min',
        levelKey: 'intermediate',
        categoryKey: 'compliance',
      },
      {
        slug: 'shield-center-mode-emploi',
        icon: 'bell',
        title: 'Shield Center : configurer vos alertes et gérer les faux avis',
        description:
          'Guide complet pour tirer parti du Shield Center — seuils d\'alerte, interprétation des scores de toxicité, procédure de contestation Google et WhatsApp temps réel.',
        readTime: '15 min',
        levelKey: 'intermediate',
        categoryKey: 'shield',
      },
      {
        slug: 'multiplateforme-google-facebook-trustpilot',
        icon: 'globe',
        title: 'Gérer votre réputation sur Google, Facebook et Trustpilot',
        description:
          'Centraliser vos avis sur les trois plateformes connectées par REPUTEXA et appliquer les bonnes pratiques par écosystème.',
        readTime: '9 min',
        levelKey: 'intermediate',
        categoryKey: 'multi',
      },
      {
        slug: 'rapports-pdf-analyses',
        icon: 'fileText',
        title: 'Analyser vos rapports PDF mensuels comme un expert',
        description:
          'Comment lire et interpréter les 12 métriques clés de votre rapport REPUTEXA pour construire un plan d\'action concret et mesurer votre progression mois après mois.',
        readTime: '7 min',
        levelKey: 'intermediate',
        categoryKey: 'analytics',
      },
      {
        slug: 'api-integration-avancee',
        icon: 'bookOpen',
        title: 'Intégration API avancée : connecter REPUTEXA à votre CRM',
        description:
          'Guide technique pour intégrer REPUTEXA dans votre écosystème : Zapier, Make, logiciels de caisse Square et SumUp. Inclut des exemples de webhook entrant et des patterns de gestion d\'erreurs.',
        readTime: '20 min',
        levelKey: 'advanced',
        categoryKey: 'api',
      },
    ],
  },
  GuidesSlug: {
    pages: {
      'demarrage-rapide': {
        title: 'Guide de démarrage',
        content:
          "Connectez votre compte Google Business Profile à REPUTEXA en quelques clics. Une fois la connexion établie, vous recevrez automatiquement les nouveaux avis et des suggestions de réponses générées par l'IA. Personnalisez le ton de vos réponses dans les paramètres pour qu'elles reflètent l'identité de votre établissement.",
      },
      'optimiser-notation': {
        title: 'Optimiser sa notation Google',
        content:
          "Répondre à tous les avis, y compris les positifs, améliore votre visibilité. Les avis négatifs bien gérés démontrent votre professionnalisme. Demandez poliment des avis à vos clients satisfaits via email ou QR code en caisse. REPUTEXA vous alerte sur les nouveaux avis pour ne jamais laisser passer une opportunité.",
      },
      'reponses-ia-personnalisees': {
        title: 'Personnaliser les réponses IA',
        content:
          "Dans vos paramètres REPUTEXA, définissez le style souhaité : formel, décontracté, bilingue. Vous pouvez aussi ajouter des informations sur votre établissement (spécialités, valeurs) pour que l'IA produise des suggestions plus pertinentes. Chaque suggestion reste modifiable avant envoi.",
      },
      'conformite-rgpd': {
        title: 'Conformité RGPD et avis',
        content:
          "Les avis Google sont des données à caractère personnel. REPUTEXA traite ces données conformément au RGPD. Les modèles d'IA utilisés ne réutilisent pas vos données pour l'entraînement. Vos clients conservent leurs droits (accès, rectification, effacement). Notre politique de confidentialité détaille l'ensemble des traitements.",
      },
      'shield-center-mode-emploi': {
        title: 'Shield Center : mode d’emploi',
        content:
          "Le Shield Center analyse chaque avis (toxicité, authenticité) et peut préparer un dossier de signalement. Configurez vos seuils dans Paramètres → Notifications, reliez WhatsApp pour les alertes temps réel, et consultez le tableau Alertes pour traiter les cas critiques en priorité.",
      },
      'multiplateforme-google-facebook-trustpilot': {
        title: 'Google, Facebook & Trustpilot',
        content:
          "Connectez chaque plateforme depuis Paramètres → Plateformes. Google via OAuth ; Facebook et Trustpilot via webhook. Une fois synchronisé, vos avis arrivent dans un flux unique : répondez avec la même qualité IA partout et suivez la distribution par source dans le dashboard.",
      },
      'rapports-pdf-analyses': {
        title: 'Lire vos rapports PDF',
        content:
          "Chaque mois, REPUTEXA génère un PDF avec synthèse et recommandations. Priorisez la tendance de note, le volume par plateforme et les thèmes récurrents dans les avis négatifs. Utilisez la section recommandations IA comme checklist pour le mois suivant.",
      },
      'api-integration-avancee': {
        title: 'API, webhooks & automatisations',
        content:
          "Sur ZENITH, générez votre clé rtx_live_ dans Paramètres → Intégrations pour envoyer des visites POS vers REPUTEXA (Zapier, Make, Square, SumUp). Respectez le format JSON documenté et testez sur un environnement de staging avant la production.",
      },
    },
  },
  HomePage: {
    nav: {
      brandAria: 'REPUTEXA — Accueil',
    },
  },
};

const patchEN = {
  PublicPages: {
    sitemapSections: [
      {
        title: 'Product',
        links: [
          { href: '/', label: 'Home' },
          { href: '/#fonctionnalités', label: 'Features' },
          { href: '/#pricing', label: 'Pricing' },
          { href: '/#témoignages', label: 'Testimonials' },
          { href: '/#faq', label: 'FAQ' },
          { href: '/pricing', label: 'Pricing page' },
          { href: '/login', label: 'Log in' },
          { href: '/signup?mode=trial', label: 'Free trial' },
        ],
      },
      {
        title: 'Resources',
        links: [
          { href: '/blog', label: 'Blog' },
          { href: '/guides', label: 'Guides' },
          { href: '/api', label: 'API' },
          { href: '/statuts', label: 'Status' },
        ],
      },
      {
        title: 'Company',
        links: [
          { href: '/about', label: 'About' },
          { href: '/careers', label: 'Careers' },
          { href: '/investors', label: 'Investors' },
          { href: '/sustainability', label: 'Sustainability' },
        ],
      },
      {
        title: 'Legal & support',
        links: [
          { href: '/contact', label: 'Contact' },
          { href: '/legal/mentions-legales', label: 'Legal notice' },
          { href: '/legal/confidentialite', label: 'Privacy' },
          { href: '/legal/cgu', label: 'Terms' },
        ],
      },
    ],
  },
  BlogPage: {
    featuredBadge: 'Featured',
    readArticle: 'Read article',
    readMore: 'Read',
    categories: {
      all: 'All',
      product: 'Product',
      trends: 'Trends',
      regulation: 'Regulation',
      guide: 'How-to',
      useCase: 'Use cases',
      seoLocal: 'Local SEO',
      cybersecurity: 'Cybersecurity',
      studies: 'Research',
      international: 'International',
    },
    categoryFilters: [
      { key: 'all', label: 'All' },
      { key: 'product', label: 'Product' },
      { key: 'trends', label: 'Trends' },
      { key: 'regulation', label: 'Regulation' },
      { key: 'guide', label: 'How-to' },
      { key: 'useCase', label: 'Use cases' },
      { key: 'seoLocal', label: 'Local SEO' },
      { key: 'cybersecurity', label: 'Cybersecurity' },
      { key: 'studies', label: 'Research' },
      { key: 'international', label: 'International' },
    ],
    posts: [
      {
        slug: 'shield-center-faux-avis-google-2026',
        title: 'How REPUTEXA Shield Center detects fake reviews with 97.4% accuracy',
        excerpt:
          'Behind our fake-review algorithm: the 14 behavioural and linguistic signals we score in real time on every review.',
        date: 'Mar 19, 2026',
        readTime: '8 min',
        categoryKey: 'product',
        featured: true,
      },
      {
        slug: 'gestion-avis-google-2026',
        title: 'Google reviews in 2026: five trends to watch',
        excerpt:
          'Generative AI, the DSA, new review formats — the Google Reviews ecosystem is moving fast. What every business should know.',
        date: 'Mar 15, 2026',
        readTime: '6 min',
        categoryKey: 'trends',
      },
      {
        slug: 'dsa-faux-avis-obligations-2026',
        title: 'DSA 2026: what changes for online reviews',
        excerpt:
          'New obligations for review platforms — practical impact for businesses and how REPUTEXA helps you stay compliant.',
        date: 'Mar 10, 2026',
        readTime: '5 min',
        categoryKey: 'regulation',
      },
      {
        slug: 'repondre-avis-negatifs',
        title: 'How to answer negative reviews without losing your cool — or your reputation',
        excerpt:
          'Practical templates to turn a bad review into loyalty — plus twelve phrases to avoid.',
        date: 'Mar 8, 2026',
        readTime: '7 min',
        categoryKey: 'guide',
      },
      {
        slug: 'ia-reputation-restauration',
        title: 'AI for restaurant reputation: five concrete use cases',
        excerpt:
          'How restaurateurs automated review replies and saved up to eight hours a week — real data, measured outcomes.',
        date: 'Mar 1, 2026',
        readTime: '9 min',
        categoryKey: 'useCase',
      },
      {
        slug: 'seo-local-avis-google',
        title: 'How Google reviews shape your local SEO in 2026',
        excerpt:
          'Reply frequency, semantic depth, volume and freshness: six factors that influence Local Pack rankings from our data.',
        date: 'Feb 22, 2026',
        readTime: '6 min',
        categoryKey: 'seoLocal',
      },
      {
        slug: 'cybersecurite-reputation-marque',
        title: 'Online reputation & cybersecurity: protecting your brand',
        excerpt:
          'Coordinated smear campaigns, review bombing and astroturfing are cyber risks your reputation stack must address.',
        date: 'Feb 14, 2026',
        readTime: '8 min',
        categoryKey: 'cybersecurity',
      },
      {
        slug: 'note-google-4-5-impact-revenu',
        title: '+34% revenue: the business impact of a ≥4.5 Google rating',
        excerpt:
          'Analysis of 3,200 locations shows a direct link between star rating and revenue — numbers every leader should see.',
        date: 'Feb 5, 2026',
        readTime: '5 min',
        categoryKey: 'studies',
      },
      {
        slug: 'multilingue-reponses-avis-europe',
        title: 'Managing reviews in nine languages: the international challenge',
        excerpt:
          'How REPUTEXA handles cultural nuance across languages to generate authentic, locale-appropriate replies.',
        date: 'Jan 28, 2026',
        readTime: '4 min',
        categoryKey: 'international',
      },
    ],
  },
  SubscribeForm: {
    successTitle: "You're all set.",
    successBody: "You'll get our flash briefings starting next Tuesday.",
    title: 'Stay in the loop',
    description:
      'Weekly flash analysis on AI, online reputation and cybersecurity — straight to your inbox every Tuesday.',
    placeholder: 'you@example.com',
    submit: 'Subscribe',
    errorGeneric: 'Something went wrong. Please try again.',
    errorNetwork: 'Network error. Check your connection and try again.',
    footerNote: 'No spam · One-click unsubscribe · Data hosted in the EU',
  },
  BlogArticle: {
    backToBlog: 'Back to blog',
    readTimeSuffix: 'read',
    updatedPrefix: 'Updated:',
    conclusionTitle: 'Conclusion',
    ctaLead: 'Ready to take action?',
    ctaButton: '14-day free trial',
    sourcesTitle: 'Sources & references',
    methodologyNote: 'Methodology note',
    methodologyDisclaimer:
      'REPUTEXA proprietary figures come from Google Business Profile data from active customers under confidentiality agreements. Third-party statistics cite primary sources.',
    relatedTitle: 'Related articles',
    categories: {
      product: 'Product',
      trends: 'Trends',
      regulation: 'Regulation',
      guide: 'How-to',
      useCase: 'Use cases',
      seoLocal: 'Local SEO',
      cybersecurity: 'Cybersecurity',
      studies: 'Research',
      international: 'International',
    },
  },
  GuidesPage: {
    stats: [
      { value: '8', label: 'Guides' },
      { value: '3', label: 'Difficulty levels' },
      { value: '91 min', label: 'Total reading time' },
    ],
    featuredBadge: 'Start here',
    readGuide: 'Read guide',
    ctaTitle: 'Need tailored support?',
    ctaBody:
      'Our team and the ZENITH strategic AI consultant can help with your specific situation.',
    ctaTrial: 'Free trial',
    ctaHelp: 'Help center',
    levels: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    },
    categoryFilters: [
      { key: 'all', label: 'All' },
      { key: 'firstSteps', label: 'Getting started' },
      { key: 'strategy', label: 'Strategy' },
      { key: 'ai', label: 'AI & branding' },
      { key: 'compliance', label: 'Compliance' },
      { key: 'shield', label: 'Shield Center' },
      { key: 'multi', label: 'Multi-platform' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'api', label: 'API & integrations' },
    ],
    guides: [
      {
        slug: 'demarrage-rapide',
        icon: 'zap',
        title: 'Quick start: REPUTEXA in five minutes',
        description:
          'Create your account, connect Google Business Profile and get your first AI reply suggestions — everything you need to go live fast.',
        readTime: '5 min',
        levelKey: 'beginner',
        categoryKey: 'firstSteps',
        featured: true,
      },
      {
        slug: 'optimiser-notation',
        icon: 'barChart2',
        title: 'Improve your Google rating: full strategic guide',
        description:
          'From 3.8 to 4.7 stars in six months — proven tactics to lift average rating, grow positive volume and fix recurring issues.',
        readTime: '12 min',
        levelKey: 'intermediate',
        categoryKey: 'strategy',
      },
      {
        slug: 'reponses-ia-personnalisees',
        icon: 'messageSquare',
        title: 'Tune AI replies to your brand voice',
        description:
          'How to configure your brand brief so every AI suggestion matches tone, values and style — with sector examples.',
        readTime: '8 min',
        levelKey: 'intermediate',
        categoryKey: 'ai',
      },
      {
        slug: 'conformite-rgpd',
        icon: 'shield',
        title: 'GDPR compliance and customer reviews',
        description:
          'Best practices for personal data in reviews and replies while staying within EU regulation.',
        readTime: '10 min',
        levelKey: 'intermediate',
        categoryKey: 'compliance',
      },
      {
        slug: 'shield-center-mode-emploi',
        icon: 'bell',
        title: 'Shield Center: alerts and fake-review workflow',
        description:
          'Thresholds, toxicity scores, Google dispute flow and real-time WhatsApp alerts — end to end.',
        readTime: '15 min',
        levelKey: 'intermediate',
        categoryKey: 'shield',
      },
      {
        slug: 'multiplateforme-google-facebook-trustpilot',
        icon: 'globe',
        title: 'Reputation on Google, Facebook and Trustpilot',
        description:
          'Centralise reviews across the three connected platforms and apply the right playbook per ecosystem.',
        readTime: '9 min',
        levelKey: 'intermediate',
        categoryKey: 'multi',
      },
      {
        slug: 'rapports-pdf-analyses',
        icon: 'fileText',
        title: 'Read your monthly PDF reports like a pro',
        description:
          'Twelve key metrics explained so you can build an action plan and track month-over-month progress.',
        readTime: '7 min',
        levelKey: 'intermediate',
        categoryKey: 'analytics',
      },
      {
        slug: 'api-integration-avancee',
        icon: 'bookOpen',
        title: 'Advanced API integration: connect REPUTEXA to your CRM',
        description:
          'Zapier, Make, Square and SumUp — inbound webhook patterns and error handling examples.',
        readTime: '20 min',
        levelKey: 'advanced',
        categoryKey: 'api',
      },
    ],
  },
  GuidesSlug: {
    pages: {
      'demarrage-rapide': {
        title: 'Getting started',
        content:
          'Connect Google Business Profile to REPUTEXA in a few clicks. Once linked, new reviews sync automatically and you get AI reply suggestions. Adjust tone in settings so replies match your brand.',
      },
      'optimiser-notation': {
        title: 'Improve your Google rating',
        content:
          'Replying to every review — including positive ones — boosts visibility. Well-handled negative reviews show professionalism. Politely ask happy customers for reviews via email or QR at checkout. REPUTEXA alerts you so nothing slips through.',
      },
      'reponses-ia-personnalisees': {
        title: 'Personalise AI replies',
        content:
          'In REPUTEXA settings, pick formal or casual tone, bilingual options, and add venue facts (specialties, values) so suggestions stay relevant. You can edit every suggestion before it goes live.',
      },
      'conformite-rgpd': {
        title: 'GDPR and reviews',
        content:
          'Google reviews are personal data. REPUTEXA processes them under GDPR. Models are not trained on your data. Customers keep access, rectification and erasure rights. See our privacy policy for full detail.',
      },
      'shield-center-mode-emploi': {
        title: 'Shield Center essentials',
        content:
          'Shield scores every review for toxicity and authenticity and can prepare a dispute pack. Set thresholds under Settings → Notifications, connect WhatsApp for instant alerts, and use the Alerts dashboard for critical cases first.',
      },
      'multiplateforme-google-facebook-trustpilot': {
        title: 'Google, Facebook & Trustpilot',
        content:
          'Connect each source under Settings → Platforms: Google via OAuth, Facebook and Trustpilot via webhook. You then get one unified feed — reply with the same AI quality everywhere and compare volume by source in the dashboard.',
      },
      'rapports-pdf-analyses': {
        title: 'Reading your PDF reports',
        content:
          'Each month REPUTEXA emails a PDF with summary and recommendations. Focus on rating trend, volume per platform and recurring negative themes. Treat the AI recommendations section as next month’s checklist.',
      },
      'api-integration-avancee': {
        title: 'API, webhooks & automation',
        content:
          'On ZENITH, create your rtx_live_ key under Settings → Integrations to send POS visits to REPUTEXA (Zapier, Make, Square, SumUp). Follow the documented JSON payload and test in staging before production.',
      },
    },
  },
  HomePage: {
    nav: {
      brandAria: 'REPUTEXA — Home',
    },
  },
};

const frPath = path.join(messagesDir, 'fr.json');
const enPath = path.join(messagesDir, 'en.json');
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
deepAssign(fr, patchFR);
deepAssign(en, patchEN);
fs.writeFileSync(frPath, JSON.stringify(fr));
fs.writeFileSync(enPath, JSON.stringify(en));
console.log('merge-public-surface-i18n: OK');
