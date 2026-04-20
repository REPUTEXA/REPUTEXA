export type SustainabilityPillarIconKey = 'server' | 'scale' | 'eye' | 'users' | 'shieldCheck';

export type SustainabilityPillar = {
  iconKey: SustainabilityPillarIconKey;
  title: string;
  color: string;
  bgColor: string;
  description: string;
  points: string[];
};

export type SustainabilityPublicContent = {
  metrics: { value: string; label: string }[];
  pillars: SustainabilityPillar[];
  roadmap: { year: string; title: string; desc: string }[];
  manifestTitle: string;
  manifestQuote: string;
  manifestAttribution: string;
  pillarsSectionTitle: string;
  roadmapTitle: string;
  ctaTitle: string;
  ctaBody: string;
  ctaPrimary: string;
  ctaSecondary: string;
};

const FR: SustainabilityPublicContent = {
  metrics: [
    { value: '90%+', label: 'Énergie renouvelable (datacenters)' },
    { value: '0', label: 'Données vendues à des tiers' },
    { value: '97%', label: 'Précision de détection éthique' },
    { value: '14k+', label: 'Faux avis signalés en 2025' },
  ],
  pillars: [
    {
      iconKey: 'server',
      title: 'Infrastructure à faible empreinte carbone',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      description:
        "Nous hébergeons l'intégralité de notre infrastructure sur Vercel et Supabase, deux plateformes engagées dans la neutralité carbone. Nos datacenters parisiens et francfortois fonctionnent avec une énergie majoritairement renouvelable (taux ENR > 90%).",
      points: [
        'Datacenters alimentés à 90%+ par des énergies renouvelables',
        'Architecture serverless : aucune ressource consommée hors usage',
        'Optimisation active de la charge computationnelle des modèles IA',
        'CDN Edge : réduction de la distance réseau et de la latence énergétique',
      ],
    },
    {
      iconKey: 'scale',
      title: 'IA responsable et non-discriminatoire',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description:
        "Nos modèles sont entraînés et auditables. Nous appliquons des principes stricts d'éthique IA : pas de biais démographiques dans l'analyse de toxicité, pas de profilage des auteurs d'avis, transparence totale sur les décisions algorithmiques.",
      points: [
        'Audits réguliers de nos modèles pour détecter les biais involontaires',
        "Aucun profilage d'individus basé sur les données comportementales",
        'Transparence sur les facteurs de décision IA (explainability)',
        'Comité éthique interne révisé semestriellement',
      ],
    },
    {
      iconKey: 'eye',
      title: 'Transparence & Accessibilité',
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/20',
      description:
        "Nous publions chaque trimestre un rapport de transparence sur l'utilisation de nos services, les incidents de sécurité et nos performances environnementales. Notre code de conformité RGPD est accessible à tous.",
      points: [
        'Rapport de transparence trimestriel publié en accès libre',
        'Politique de divulgation responsable (Responsible Disclosure)',
        'Interface accessible (WCAG 2.1 AA) pour les personnes en situation de handicap',
        'Tarifs lisibles et sans frais cachés — engagement anti-dark patterns',
      ],
    },
    {
      iconKey: 'users',
      title: 'Impact social positif',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      description:
        'REPUTEXA protège les PME et indépendants contre les pratiques déloyales en ligne. Notre technologie rééquilibre le rapport de force entre les grands groupes et les petits établissements en matière de gestion de réputation.',
      points: [
        '73% de nos clients sont des TPE/PME de moins de 10 salariés',
        'Tarifs accessibles aux indépendants avec engagement mensuel sans frais de résiliation',
        'Programme "Solidarité Locale" : -50% pour les associations et EHPAD',
        "Formation gratuite à la gestion d'e-réputation pour nos clients en début d'activité",
      ],
    },
    {
      iconKey: 'shieldCheck',
      title: 'Lutte contre la désinformation',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20',
      description:
        "En détectant et en signalant les faux avis et les campagnes de dénigrement coordonnées, REPUTEXA contribue activement à un écosystème numérique plus sain et plus honnête pour l'ensemble des consommateurs.",
      points: [
        '14 000+ faux avis signalés aux plateformes en 2025',
        "Coopération avec les équipes Trust & Safety des principales plateformes d'avis",
        'Contribution aux travaux du groupe de travail DSA (Digital Services Act)',
        'Publication mensuelle des statistiques de détection de fraude',
      ],
    },
  ],
  roadmap: [
    {
      year: 'Q2 2026',
      title: 'Rapport de transparence v1',
      desc: 'Premier rapport public complet avec métriques environnementales et sociales.',
    },
    {
      year: 'Q3 2026',
      title: 'Certification SOC 2 Type II',
      desc: 'Audit indépendant de nos contrôles de sécurité et de confidentialité.',
    },
    {
      year: 'Q4 2026',
      title: 'Programme Solidarité Locale étendu',
      desc: "Extension à 500 structures associatives et acteurs de l'ESS.",
    },
    {
      year: '2027',
      title: 'Neutralité carbone certifiée',
      desc: "Compensation de l'empreinte carbone résiduelle via des projets de reforestation certifiés Gold Standard.",
    },
  ],
  manifestTitle: 'Notre manifeste',
  manifestQuote:
    "L'intelligence artificielle ne doit pas seulement être puissante — elle doit être juste, transparente et respectueuse de l'environnement numérique dans lequel elle opère. Chez REPUTEXA, chaque ligne de code est écrite avec la conviction que la confiance se gagne, et ne se décrète pas.",
  manifestAttribution: "— L'équipe fondatrice de REPUTEXA",
  pillarsSectionTitle: 'Nos 5 piliers de responsabilité',
  roadmapTitle: 'Feuille de route responsabilité',
  ctaTitle: 'Une question sur notre démarche ?',
  ctaBody:
    'Notre rapport de transparence complet et notre politique IA éthique sont disponibles sur demande. Notre équipe legal & éthique répond sous 48h.',
  ctaPrimary: "Contacter l'équipe éthique",
  ctaSecondary: 'Rapport de transparence',
};

const EN: SustainabilityPublicContent = {
  metrics: [
    { value: '90%+', label: 'Renewable energy (datacenters)' },
    { value: '0', label: 'Data sold to third parties' },
    { value: '97%', label: 'Ethical detection accuracy' },
    { value: '14k+', label: 'Fake reviews flagged in 2025' },
  ],
  pillars: [
    {
      iconKey: 'server',
      title: 'Low-carbon infrastructure',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      description:
        'We run on Vercel and Supabase—both committed to carbon neutrality. Paris and Frankfurt regions run largely on renewable power (>90% renewable mix).',
      points: [
        'Datacenters 90%+ renewable-powered',
        'Serverless architecture: no idle capacity burn',
        'Active optimization of model compute cost and energy',
        'Edge CDN: shorter paths, lower network energy',
      ],
    },
    {
      iconKey: 'scale',
      title: 'Responsible, non-discriminatory AI',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description:
        'Models are trainable and auditable. Strict ethics: no demographic bias in toxicity scoring, no profiling of reviewers, transparent algorithmic factors.',
      points: [
        'Regular model audits for unintended bias',
        'No individual profiling from behavioural signals',
        'Explainability on AI decision factors',
        'Internal ethics committee reviewed twice yearly',
      ],
    },
    {
      iconKey: 'eye',
      title: 'Transparency & accessibility',
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/20',
      description:
        'Quarterly transparency reports cover usage, security incidents, and environmental metrics. GDPR compliance materials are public.',
      points: [
        'Open quarterly transparency report',
        'Responsible disclosure policy',
        'WCAG 2.1 AA-oriented UI work',
        'Clear pricing—no dark patterns',
      ],
    },
    {
      iconKey: 'users',
      title: 'Positive social impact',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      description:
        'REPUTEXA helps SMBs fight unfair online practices—rebalancing leverage vs large chains in reputation management.',
      points: [
        '73% of customers are SMBs with <10 employees',
        'Affordable plans for independents, monthly terms without exit fees',
        '"Local Solidarity" program: −50% for nonprofits and care homes',
        'Free reputation-management onboarding for new businesses',
      ],
    },
    {
      iconKey: 'shieldCheck',
      title: 'Fighting disinformation',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20',
      description:
        'By detecting and reporting fake reviews and coordinated smear campaigns, we help keep the review ecosystem healthier for consumers.',
      points: [
        '14,000+ fake reviews escalated to platforms in 2025',
        'Cooperation with trust & safety teams at major review platforms',
        'Participation in DSA working groups',
        'Monthly fraud-detection statistics published',
      ],
    },
  ],
  roadmap: [
    {
      year: 'Q2 2026',
      title: 'Transparency report v1',
      desc: 'First public report with environmental and social KPIs.',
    },
    {
      year: 'Q3 2026',
      title: 'SOC 2 Type II certification',
      desc: 'Independent audit of security and confidentiality controls.',
    },
    {
      year: 'Q4 2026',
      title: 'Expanded Local Solidarity program',
      desc: '500 nonprofit and social-economy organizations supported.',
    },
    {
      year: '2027',
      title: 'Certified carbon neutrality',
      desc: 'Residual footprint offset via Gold Standard reforestation projects.',
    },
  ],
  manifestTitle: 'Our manifesto',
  manifestQuote:
    'Artificial intelligence must not only be powerful—it must be fair, transparent, and respectful of the digital environment it operates in. At REPUTEXA, every line of code reflects a simple belief: trust is earned, not declared.',
  manifestAttribution: '— The REPUTEXA founding team',
  pillarsSectionTitle: 'Our five responsibility pillars',
  roadmapTitle: 'Responsibility roadmap',
  ctaTitle: 'Questions about our approach?',
  ctaBody:
    'Full transparency report and ethical AI policy available on request. Legal & ethics replies within 48 hours.',
  ctaPrimary: 'Contact the ethics team',
  ctaSecondary: 'Transparency report',
};

export function getSustainabilityPublicContent(locale: string): SustainabilityPublicContent {
  return locale === 'fr' ? FR : EN;
}
