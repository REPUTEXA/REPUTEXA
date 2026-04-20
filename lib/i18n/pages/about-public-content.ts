export type AboutValueIconKey = 'brain' | 'scale' | 'shield' | 'heart';
export type AboutAchievementIconKey = 'star' | 'trendingUp' | 'globe';

export type AboutPublicContent = {
  missionEyebrow: string;
  missionQuote: string;
  missionAttribution: string;
  metrics: { value: string; label: string }[];
  storyTitle: string;
  storyParagraphs: string[];
  valuesTitle: string;
  values: { iconKey: AboutValueIconKey; title: string; description: string }[];
  timelineTitle: string;
  timeline: { year: string; title: string; desc: string }[];
  teamTitle: string;
  teamMeta: string;
  teamIntro: string;
  teamValues: string[];
  careersLink: string;
  achievementsTitle: string;
  achievements: { iconKey: AboutAchievementIconKey; title: string; desc: string }[];
  ctaTrial: string;
  ctaContact: string;
  ctaInvestors: string;
};

const FR: AboutPublicContent = {
  missionEyebrow: 'Notre mission',
  missionQuote:
    "Nous donnons à chaque établissement — de la boulangerie de quartier au groupe hôtelier international — les mêmes outils d'IA de pointe que les grandes marques pour gérer, protéger et développer leur réputation numérique.",
  missionAttribution: "— L'équipe fondatrice de REPUTEXA, Paris 2024",
  metrics: [
    { value: '3 200+', label: 'Établissements actifs' },
    { value: '2,1M', label: "Avis traités par l'IA" },
    { value: '+0,7★', label: 'Gain de note moyen' },
    { value: '97,4%', label: 'Précision Shield Center' },
  ],
  storyTitle: 'Notre histoire',
  storyParagraphs: [
    "REPUTEXA est né d'une observation simple mais troublante : un restaurateur qui reçoit un faux avis 1 étoile coordonné peut perdre jusqu'à 30% de ses réservations en quelques jours — sans avoir aucun recours efficace. Pendant ce temps, les grandes chaînes disposent d'équipes dédiées à la gestion de leur réputation numérique.",
    "Nous avons fondé REPUTEXA pour inverser ce rapport de force. En combinant les derniers modèles de langage (Claude d'Anthropic) avec notre Shield Center propriétaire — capable de détecter les faux avis avec 97,4% de précision — nous offrons aux PME et indépendants une puissance de feu réputationnelle jusque-là réservée aux grandes entreprises.",
    'Fondée en France, REPUTEXA opère en conformité totale avec le RGPD. Nos données sont hébergées exclusivement en Union européenne. Nous ne vendons aucune donnée à des tiers et ne monétisons jamais les informations de vos clients.',
  ],
  valuesTitle: 'Nos valeurs fondamentales',
  values: [
    {
      iconKey: 'brain',
      title: "L'IA au service de l'humain",
      description:
        "Nous croyons que l'intelligence artificielle doit amplifier les capacités humaines, pas les remplacer. Chaque suggestion de réponse REPUTEXA est conçue pour rester sous le contrôle éditorial des équipes qui la publient.",
    },
    {
      iconKey: 'scale',
      title: "L'intégrité numérique comme droit",
      description:
        "Les faux avis, les campagnes de dénigrement et la désinformation en ligne causent des préjudices réels à des milliers d'entrepreneurs. REPUTEXA défend le droit de chaque établissement à une réputation numérique juste et authentique.",
    },
    {
      iconKey: 'shield',
      title: 'La sécurité sans compromis',
      description:
        "Données hébergées en Union européenne, chiffrement AES-256-GCM, TLS 1.3, conformité RGPD totale. La protection de vos données et de celles de vos clients n'est pas une case à cocher — c'est notre architecture.",
    },
    {
      iconKey: 'heart',
      title: "L'accessibilité pour tous",
      description:
        "De la boulangerie artisanale au groupe hôtelier de 50 établissements, REPUTEXA est conçu pour être accessible, simple et efficace à chaque échelle. 73% de nos clients sont des TPE/PME.",
    },
  ],
  timelineTitle: 'Notre parcours',
  timeline: [
    {
      year: '2024',
      title: 'Fondation & Première version',
      desc: "REPUTEXA est fondé avec une conviction simple : l'IA peut rééquilibrer le rapport de force entre les plateformes d'avis et les établissements qui y figurent.",
    },
    {
      year: 'T1 2025',
      title: 'Lancement public & 100 premiers clients',
      desc: 'La plateforme ouvre au public. Cent restaurants, hôtels et commerçants deviennent nos premiers clients — leurs retours façonnent profondément le produit.',
    },
    {
      year: 'T3 2025',
      title: 'Shield Center & Alertes WhatsApp',
      desc: 'Lancement du Shield Center, notre système de détection de toxicité et de faux avis. Intégration des alertes WhatsApp en temps réel. Franchissement des 500 établissements actifs.',
    },
    {
      year: 'T4 2025',
      title: '1 000 établissements · API v1',
      desc: "REPUTEXA dépasse les 1 000 établissements actifs et ouvre son API aux développeurs. Lancement du plan ZENITH avec le Consultant Stratégique IA.",
    },
    {
      year: 'Q1 2026',
      title: '3 200 établissements · Expansion européenne',
      desc: "Ouverture des marchés espagnol, italien et allemand. Plus de 2,1 millions d'avis traités par l'IA depuis le lancement. Lancement de l'audit SOC 2 Type II.",
    },
  ],
  teamTitle: 'Notre équipe',
  teamMeta: '18 collaborateurs · 12 nationalités',
  teamIntro:
    "REPUTEXA est construit par une équipe de passionnés d'IA, d'ingénieurs fullstack, de data scientists et de spécialistes de la croissance B2B. Nous sommes remote-first, avec une présence forte à Paris et des équipes réparties dans toute l'Europe.",
  teamValues: [
    "Remote-first — vous travaillez d'où vous êtes le plus efficace",
    'Équipe de 18 personnes de 12 nationalités',
    'Stack dernière génération : Next.js, Claude, Supabase, TypeScript',
    'BSPCE dès le premier jour pour tous les collaborateurs',
    'Culture de la transparence et de la décision rapide',
  ],
  careersLink: "Rejoindre l'équipe — 6 postes ouverts",
  achievementsTitle: 'Reconnaissances',
  achievements: [
    {
      iconKey: 'star',
      title: '4,9★ sur G2',
      desc: 'Note moyenne basée sur 240+ avis vérifiés de clients',
    },
    {
      iconKey: 'trendingUp',
      title: 'Top 10 SaaS E-réputation',
      desc: 'Classement Capterra 2026 — catégorie Review Management',
    },
    {
      iconKey: 'globe',
      title: 'French Tech 120',
      desc: 'Labellisé French Tech 2026 par le Gouvernement français',
    },
  ],
  ctaTrial: 'Essai gratuit 14 jours',
  ctaContact: 'Nous contacter',
  ctaInvestors: 'Espace investisseurs',
};

const EN: AboutPublicContent = {
  missionEyebrow: 'Our mission',
  missionQuote:
    'We give every business — from the neighborhood bakery to the international hotel group — the same cutting-edge AI tools large brands use to manage, protect, and grow their online reputation.',
  missionAttribution: '— The founding team, REPUTEXA, Paris 2024',
  metrics: [
    { value: '3,200+', label: 'Active locations' },
    { value: '2.1M', label: 'Reviews processed by AI' },
    { value: '+0.7★', label: 'Average rating lift' },
    { value: '97.4%', label: 'Shield Center accuracy' },
  ],
  storyTitle: 'Our story',
  storyParagraphs: [
    'REPUTEXA started from a simple, unsettling fact: a coordinated one-star fake review can cost a restaurant up to 30% of reservations in days — with little effective recourse. Meanwhile, large chains run dedicated teams for online reputation.',
    'We built REPUTEXA to rebalance that. By pairing the latest language models (Anthropic Claude) with our proprietary Shield Center — 97.4% precision on fake-review signals — we give SMBs and independents reputation firepower that used to be enterprise-only.',
    'Founded in France, REPUTEXA is fully GDPR-aligned. Data is hosted exclusively in the European Union. We never sell your data to third parties or monetize your customers’ information.',
  ],
  valuesTitle: 'Core values',
  values: [
    {
      iconKey: 'brain',
      title: 'AI in service of people',
      description:
        'Artificial intelligence should amplify human judgment, not replace it. Every REPUTEXA reply suggestion stays under the editorial control of the team that publishes it.',
    },
    {
      iconKey: 'scale',
      title: 'Digital integrity as a right',
      description:
        'Fake reviews, smear campaigns, and online disinformation cause real harm to thousands of operators. REPUTEXA stands for every business’s right to a fair, authentic digital reputation.',
    },
    {
      iconKey: 'shield',
      title: 'Security without compromise',
      description:
        'EU hosting, AES-256-GCM encryption, TLS 1.3, full GDPR compliance. Protecting your data and your customers’ data is not a checkbox — it is our architecture.',
    },
    {
      iconKey: 'heart',
      title: 'Accessible by design',
      description:
        'From artisan bakeries to 50-location hotel groups, REPUTEXA is built to be approachable, simple, and effective at every scale. 73% of our customers are SMBs.',
    },
  ],
  timelineTitle: 'Our journey',
  timeline: [
    {
      year: '2024',
      title: 'Foundation & first release',
      desc: 'REPUTEXA was founded on one belief: AI can rebalance power between review platforms and the businesses listed on them.',
    },
    {
      year: 'Q1 2025',
      title: 'Public launch & first 100 customers',
      desc: 'The platform opens to the public. One hundred restaurants, hotels, and retailers become our first customers — their feedback shapes the product.',
    },
    {
      year: 'Q3 2025',
      title: 'Shield Center & WhatsApp alerts',
      desc: 'Shield Center launches for toxicity and fake-review signals. Real-time WhatsApp alerts ship. We pass 500 active locations.',
    },
    {
      year: 'Q4 2025',
      title: '1,000 locations · API v1',
      desc: 'REPUTEXA crosses 1,000 active locations and opens its API to developers. ZENITH launches with the AI Strategy Consultant.',
    },
    {
      year: 'Q1 2026',
      title: '3,200 locations · European expansion',
      desc: 'Spain, Italy, and Germany open. Over 2.1 million reviews processed by AI since launch. SOC 2 Type II audit underway.',
    },
  ],
  teamTitle: 'Our team',
  teamMeta: '18 people · 12 nationalities',
  teamIntro:
    'REPUTEXA is built by AI enthusiasts, full-stack engineers, data scientists, and B2B growth specialists. We are remote-first with a strong Paris hub and teammates across Europe.',
  teamValues: [
    'Remote-first — work where you are most effective',
    'Team of 18 across 12 nationalities',
    'Modern stack: Next.js, Claude, Supabase, TypeScript',
    'Employee stock from day one',
    'Culture of transparency and fast decisions',
  ],
  careersLink: 'Join the team — 6 open roles',
  achievementsTitle: 'Recognition',
  achievements: [
    {
      iconKey: 'star',
      title: '4.9★ on G2',
      desc: 'Average rating from 240+ verified customer reviews',
    },
    {
      iconKey: 'trendingUp',
      title: 'Top 10 e-reputation SaaS',
      desc: 'Capterra 2026 ranking — Review Management',
    },
    {
      iconKey: 'globe',
      title: 'French Tech 120',
      desc: 'French Tech 2026 label — French government initiative',
    },
  ],
  ctaTrial: '14-day free trial',
  ctaContact: 'Contact us',
  ctaInvestors: 'Investor relations',
};

export function getAboutPublicContent(locale: string): AboutPublicContent {
  return locale === 'fr' ? FR : EN;
}
