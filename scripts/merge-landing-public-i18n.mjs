/**
 * Footer marketing, coquille pages publiques, chatbot, titres des pages liées.
 * Puis : node scripts/sync-all-locale-messages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

const FR = {
  LandingFooter: {
    tagline:
      'La plateforme IA de gestion de réputation en ligne pour les entreprises ambitieuses.',
    ariaBrand: 'REPUTEXA',
    copyright: '© {year} REPUTEXA, Inc. Tous droits réservés.',
    legalNavAria: 'Liens légaux',
    colResources: 'Ressources',
    colHelp: 'Aide',
    colCompany: 'Entreprise',
    colProduct: 'Produit',
    linkDocumentation: 'Documentation',
    linkBlog: 'Blog',
    linkGuides: 'Guides',
    linkApi: 'API',
    linkStatuts: 'Statuts',
    linkHelpCenter: "Centre d'aide",
    linkContact: 'Contact',
    linkReportIssue: 'Rapporter un problème',
    linkDataRights: 'Droits des clients finaux',
    linkSecurity: 'Sécurité & RGPD',
    linkAbout: 'À propos',
    linkNews: 'Actualités',
    linkCareers: 'Carrières',
    linkInvestors: 'Investisseurs',
    linkSustainability: 'Développement durable',
    linkPricing: 'Tarifs',
    linkFeatures: 'Fonctionnalités',
    linkTestimonials: 'Témoignages',
    linkFreeTrial: 'Essai gratuit',
    linkLogin: 'Connexion',
    legalMentions: 'Mentions légales',
    legalPrivacy: 'Confidentialité',
    legalTerms: 'CGU',
    legalCookies: 'Cookies',
    linkSitemap: 'Plan du site',
  },
  PublicPageShell: {
    ariaBrand: 'REPUTEXA',
    navAria: 'Navigation',
    navFeatures: 'Fonctionnalités',
    navPricing: 'Tarifs',
    navBlog: 'Blog',
    navHelp: 'Aide',
    navLogin: 'Connexion',
    navFreeTrial: 'Essai gratuit',
    navTrialShort: 'Essai',
    copyright: '© {year} REPUTEXA, Inc. Tous droits réservés.',
  },
  FooterLocale: {
    chooseLanguage: 'Choisir la langue',
  },
  Chatbot: {
    welcome:
      "Bonjour ! Je suis l'assistant IA REPUTEXA, branché sur nos tarifs et fonctionnalités à jour. Posez-moi tout : plans Vision / Pulse / Zenith, essai, avis Google, alertes, multi-établissements...",
    quickReply0: "Comment marche l'essai gratuit ?",
    quickReply1: 'Différences Vision, Pulse et Zenith',
    quickReply2: 'Alertes WhatsApp et avis négatifs',
    quickReply3: 'Tarifs multi-établissements',
    errorFetch: 'Erreur',
    noResponse: 'Désolé, pas de réponse.',
    errorSorry:
      "Désolé, une erreur s'est produite. Réessayez ou contactez-nous.",
    thinking: 'Réflexion',
    trialCta: "14 jours d'essai gratuit",
    placeholder: 'Votre question…',
    send: 'Envoyer',
    openChat: 'Ouvrir l’assistant IA REPUTEXA',
    closeChat: 'Fermer le chat',
    dialogLabel: 'Assistant IA REPUTEXA',
    launcherTitle: 'Assistant IA',
    launcherSubtitle: 'REPUTEXA · réponses à jour',
    headerSubtitle: 'Assistant IA · tarifs & produit synchronisés',
    brandName: 'REPUTEXA',
  },
  PublicPages: {
    documentation: {
      title: 'Documentation REPUTEXA',
      subtitle:
        "Guide de démarrage et d'intégration — basé sur le fonctionnement réel de la plateforme.",
    },
    help: {
      title: "Centre d'aide",
      subtitle:
        'Réponses à toutes vos questions sur REPUTEXA — IA, Shield Center, intégration et facturation.',
    },
    api: {
      title: 'API REPUTEXA',
      subtitle:
        "Intégrez REPUTEXA dans vos systèmes pour déclencher automatiquement la collecte d'avis après chaque visite client.",
    },
    statuts: {
      title: 'Statut des services REPUTEXA',
      subtitle:
        "Surveillance en temps réel de la disponibilité de l'ensemble des composants de la plateforme.",
    },
    sitemap: {
      title: 'Plan du site',
      subtitle: 'Toutes les pages de REPUTEXA en un coup d’œil.',
    },
    guides: {
      title: 'Guides & Tutoriels',
      subtitle:
        "Tout ce qu'il faut pour maîtriser REPUTEXA et maximiser votre stratégie d'e-réputation.",
    },
    guidesSlug: {
      notFoundTitle: 'Guide non trouvé',
      notFoundBody: "Ce guide n'existe pas ou a été déplacé.",
      backToGuides: 'Retour aux guides',
    },
    reportIssue: {
      sentTitle: 'Rapport envoyé',
      sentSubtitle: 'Merci pour votre signalement — notre équipe technique en prend note.',
      formTitle: 'Signaler un problème',
      formSubtitle:
        'Aidez-nous à améliorer REPUTEXA — chaque rapport est analysé par notre équipe technique sous 4 heures ouvrées.',
      toastSelectType: 'Sélectionnez un type de problème et un niveau de priorité.',
      toastSendError: 'Une erreur est survenue. Réessayez.',
      toastNetwork: 'Erreur réseau. Vérifiez votre connexion et réessayez.',
    },
    testimonials: {
      title: 'Ils font confiance à REPUTEXA',
      subtitle:
        'Plus de 3 200 établissements en France et en Europe ont transformé leur e-réputation avec notre plateforme.',
    },
    features: {
      title: 'Fonctionnalités REPUTEXA',
      subtitle:
        'Chaque fonctionnalité est implémentée et active — aucun roadmap item, aucune promesse marketing.',
    },
    newsletterUnsubscribe: {
      title: 'Désabonnement — REPUTEXA',
      subtitle: 'Gérez vos préférences de communication REPUTEXA.',
    },
    sustainability: {
      title: 'Engagement pour une IA responsable',
      subtitle:
        'Chez REPUTEXA, la technologie avancée et la responsabilité éthique ne sont pas opposées — elles sont indissociables.',
    },
    careers: {
      title: 'Rejoindre REPUTEXA',
      subtitle:
        "Construisons ensemble l'IA qui protège l'intégrité numérique des entreprises à l'échelle mondiale.",
    },
    news: {
      title: 'Actualités REPUTEXA',
      subtitle:
        'Communiqués de presse, mises à jour produit et jalons majeurs de notre développement.',
    },
    investors: {
      title: 'Espace Investisseurs',
      subtitle:
        'REPUTEXA construit la plateforme de référence pour la gestion de réputation IA en Europe. Vision, scalabilité et roadmap.',
    },
    freeTrial: {
      title: 'Essai gratuit 14 jours',
      subtitle:
        'Accès complet au plan ZENITH — aucune carte bancaire, aucun engagement, aucun risque.',
    },
    blog: {
      title: 'Blog REPUTEXA',
      subtitle:
        "Actualités, analyses et bonnes pratiques pour votre e-réputation, l'IA et la cybersécurité des marques.",
    },
    about: {
      title: "L'IA au service de l'intégrité numérique",
      subtitle:
        "REPUTEXA est la plateforme d'intelligence artificielle qui protège et développe la réputation en ligne des entreprises ambitieuses.",
    },
    security: {
      title: 'Sécurité & Conformité',
      subtitle:
        'Architecture de sécurité basée sur des fournisseurs certifiés SOC 2 — conformité RGPD native.',
    },
    contact: {
      legalMentions: 'Mentions légales',
      legalPrivacy: 'Confidentialité',
      legalTerms: 'CGU',
      title: 'Support & Contact',
      subtitle:
        'Une question, un problème technique ou une demande de partenariat ? Nous répondons sous 24h.',
      emailDirect: 'Email direct',
      labelName: 'Nom',
      placeholderName: 'Jean Dupont',
      labelEmail: 'Email',
      placeholderEmail: 'vous@exemple.com',
      labelSubject: 'Sujet',
      placeholderSubject: 'Support, facturation, partenariat...',
      labelMessage: 'Message',
      dictationTranscribing: 'Transcription...',
      dictationStop: 'Arrêter',
      dictationStart: 'Dictée vocale',
      placeholderMessage: 'Décrivez votre demande...',
      attachmentsLabel: 'Pièces jointes (optionnel)',
      attachmentsHint: 'Glissez-déposez ou cliquez · max {maxFiles} fichiers, {maxMb} Mo chacun',
      addPhotosVideos: 'Photos / Vidéos',
      removeFileAria: 'Supprimer',
      sending: 'Envoi en cours...',
      submit: 'Envoyer mon message',
      footerCopyright: '© {year} REPUTEXA. Tous droits réservés.',
      toastTranscribeError: 'Erreur de transcription',
      toastTranscribeOk: 'Texte transcrit et ajouté au message.',
      toastTranscribeEmpty: "Aucun texte détecté dans l'enregistrement.",
      toastTranscribeFail: 'Erreur lors de la transcription.',
      toastMicDenied: "Microphone inaccessible. Autorisez l'accès au micro.",
      toastFieldsRequired: 'Tous les champs sont obligatoires.',
      toastSendError: 'Une erreur est survenue.',
      toastSendOk: 'Votre message a bien été envoyé. Nous vous répondrons rapidement.',
      toastNetworkError:
        'Erreur réseau. Réessayez ou contactez-nous à contact@reputexa.fr.',
    },
  },
};

const EN = {
  LandingFooter: {
    tagline:
      'The AI platform for online reputation management — built for ambitious businesses.',
    ariaBrand: 'REPUTEXA',
    copyright: '© {year} REPUTEXA, Inc. All rights reserved.',
    legalNavAria: 'Legal links',
    colResources: 'Resources',
    colHelp: 'Help',
    colCompany: 'Company',
    colProduct: 'Product',
    linkDocumentation: 'Documentation',
    linkBlog: 'Blog',
    linkGuides: 'Guides',
    linkApi: 'API',
    linkStatuts: 'Status',
    linkHelpCenter: 'Help center',
    linkContact: 'Contact',
    linkReportIssue: 'Report an issue',
    linkDataRights: 'End-customer rights',
    linkSecurity: 'Security & GDPR',
    linkAbout: 'About',
    linkNews: 'News',
    linkCareers: 'Careers',
    linkInvestors: 'Investors',
    linkSustainability: 'Sustainability',
    linkPricing: 'Pricing',
    linkFeatures: 'Features',
    linkTestimonials: 'Testimonials',
    linkFreeTrial: 'Free trial',
    linkLogin: 'Log in',
    legalMentions: 'Legal notice',
    legalPrivacy: 'Privacy',
    legalTerms: 'Terms',
    legalCookies: 'Cookies',
    linkSitemap: 'Sitemap',
  },
  PublicPageShell: {
    ariaBrand: 'REPUTEXA',
    navAria: 'Navigation',
    navFeatures: 'Features',
    navPricing: 'Pricing',
    navBlog: 'Blog',
    navHelp: 'Help',
    navLogin: 'Log in',
    navFreeTrial: 'Free trial',
    navTrialShort: 'Trial',
    copyright: '© {year} REPUTEXA, Inc. All rights reserved.',
  },
  FooterLocale: {
    chooseLanguage: 'Choose language',
  },
  Chatbot: {
    welcome:
      "Hi! I'm REPUTEXA's AI assistant, synced with our live pricing and features. Ask anything: Vision / Pulse / Zenith, free trial, Google reviews, alerts, multi-location...",
    quickReply0: 'How does the 14-day trial work?',
    quickReply1: 'Vision vs Pulse vs Zenith',
    quickReply2: 'WhatsApp alerts and bad reviews',
    quickReply3: 'Pricing for multiple locations',
    errorFetch: 'Error',
    noResponse: 'Sorry, no response.',
    errorSorry: 'Sorry, something went wrong. Try again or reach out to us.',
    thinking: 'Thinking',
    trialCta: 'Start 14-day trial',
    placeholder: 'Your question…',
    send: 'Send',
    openChat: 'Open REPUTEXA AI assistant',
    closeChat: 'Close chat',
    dialogLabel: 'REPUTEXA AI assistant',
    launcherTitle: 'AI assistant',
    launcherSubtitle: 'REPUTEXA · up-to-date answers',
    headerSubtitle: 'AI assistant · pricing & product in sync',
    brandName: 'REPUTEXA',
  },
  PublicPages: {
    documentation: {
      title: 'REPUTEXA documentation',
      subtitle: 'Getting started and integration guide — based on how the platform actually works.',
    },
    help: {
      title: 'Help center',
      subtitle: 'Answers about REPUTEXA — AI, Shield Center, integration and billing.',
    },
    api: {
      title: 'REPUTEXA API',
      subtitle:
        'Integrate REPUTEXA to automatically trigger review collection after each customer visit.',
    },
    statuts: {
      title: 'REPUTEXA service status',
      subtitle: 'Real-time availability of all platform components.',
    },
    sitemap: {
      title: 'Sitemap',
      subtitle: 'All REPUTEXA pages at a glance.',
    },
    guides: {
      title: 'Guides & tutorials',
      subtitle: 'Everything you need to master REPUTEXA and grow your e-reputation.',
    },
    guidesSlug: {
      notFoundTitle: 'Guide not found',
      notFoundBody: 'This guide does not exist or has been moved.',
      backToGuides: 'Back to guides',
    },
    reportIssue: {
      sentTitle: 'Report sent',
      sentSubtitle: 'Thank you — our technical team has received your report.',
      formTitle: 'Report an issue',
      formSubtitle:
        'Help us improve REPUTEXA — every report is reviewed within 4 business hours.',
      toastSelectType: 'Select an issue type and a priority level.',
      toastSendError: 'Something went wrong. Please try again.',
      toastNetwork: 'Network error. Check your connection and try again.',
    },
    testimonials: {
      title: 'They trust REPUTEXA',
      subtitle:
        'Over 3,200 businesses in France and Europe have transformed their e-reputation with our platform.',
    },
    features: {
      title: 'REPUTEXA features',
      subtitle: 'Every feature is live in production — no roadmap vaporware.',
    },
    newsletterUnsubscribe: {
      title: 'Unsubscribe — REPUTEXA',
      subtitle: 'Manage your REPUTEXA communication preferences.',
    },
    sustainability: {
      title: 'Responsible AI commitment',
      subtitle:
        'At REPUTEXA, advanced technology and ethical responsibility go hand in hand.',
    },
    careers: {
      title: 'Join REPUTEXA',
      subtitle: "Let's build the AI that protects businesses' digital integrity worldwide.",
    },
    news: {
      title: 'REPUTEXA news',
      subtitle: 'Press releases, product updates and major milestones.',
    },
    investors: {
      title: 'Investor relations',
      subtitle:
        'REPUTEXA is building the reference AI reputation platform in Europe — vision, scale and roadmap.',
    },
    freeTrial: {
      title: '14-day free trial',
      subtitle: 'Full ZENITH access — no card, no commitment, no risk.',
    },
    blog: {
      title: 'REPUTEXA blog',
      subtitle: 'News, analysis and best practices for e-reputation, AI and brand security.',
    },
    about: {
      title: 'AI for digital integrity',
      subtitle:
        'REPUTEXA is the AI platform that protects and grows the online reputation of ambitious businesses.',
    },
    security: {
      title: 'Security & compliance',
      subtitle: 'Security architecture built on SOC 2–certified providers — GDPR by design.',
    },
    contact: {
      legalMentions: 'Legal notice',
      legalPrivacy: 'Privacy',
      legalTerms: 'Terms',
      title: 'Support & contact',
      subtitle:
        'A question, a technical issue or a partnership request? We reply within 24 hours.',
      emailDirect: 'Direct email',
      labelName: 'Name',
      placeholderName: 'Jane Doe',
      labelEmail: 'Email',
      placeholderEmail: 'you@example.com',
      labelSubject: 'Subject',
      placeholderSubject: 'Support, billing, partnership...',
      labelMessage: 'Message',
      dictationTranscribing: 'Transcribing...',
      dictationStop: 'Stop',
      dictationStart: 'Voice dictation',
      placeholderMessage: 'Describe your request...',
      attachmentsLabel: 'Attachments (optional)',
      attachmentsHint: 'Drag and drop or click · max {maxFiles} files, {maxMb} MB each',
      addPhotosVideos: 'Photos / videos',
      removeFileAria: 'Remove',
      sending: 'Sending...',
      submit: 'Send message',
      footerCopyright: '© {year} REPUTEXA. All rights reserved.',
      toastTranscribeError: 'Transcription error',
      toastTranscribeOk: 'Text transcribed and added to your message.',
      toastTranscribeEmpty: 'No speech detected in the recording.',
      toastTranscribeFail: 'Transcription failed.',
      toastMicDenied: 'Microphone unavailable. Please allow microphone access.',
      toastFieldsRequired: 'All fields are required.',
      toastSendError: 'Something went wrong.',
      toastSendOk: 'Your message was sent. We will get back to you shortly.',
      toastNetworkError: 'Network error. Try again or email contact@reputexa.fr.',
    },
  },
};

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = target[k] && typeof target[k] === 'object' && !Array.isArray(target[k]) ? target[k] : {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const frPath = path.join(messagesDir, 'fr.json');
const enPath = path.join(messagesDir, 'en.json');
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
deepAssign(fr, FR);
deepAssign(en, EN);
fs.writeFileSync(frPath, JSON.stringify(fr));
fs.writeFileSync(enPath, JSON.stringify(en));
console.log('Merged LandingFooter, PublicPageShell, FooterLocale, Chatbot, PublicPages into fr.json + en.json');
