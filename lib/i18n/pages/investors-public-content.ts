import type { ExtraField } from '@/components/department-contact-form';
import { formatPlanTrioCatalogEur } from '@/lib/i18n/pricing-message-format';

export type InvestorsDiffIconKey = 'brain' | 'shield' | 'layers' | 'globe';

export type InvestorsPublicContent = {
  extraFields: ExtraField[];
  kpis: { value: string; label: string; trend: string }[];
  market: { value: string; label: string; desc: string }[];
  differentiators: { iconKey: InvestorsDiffIconKey; title: string; description: string }[];
  roadmap: { period: string; milestones: string[] }[];
  unitEconomics: { metric: string; value: string; note: string }[];
  trustSignals: string[];
  visionTitle: string;
  visionP1: string;
  visionP2: string;
  marketTitle: string;
  marketMacroLabel: string;
  marketMacroBody: string;
  diffTitle: string;
  unitTitle: string;
  roadmapTitle: string;
  trustTitle: string;
  formHeading: string;
  formDescription: string;
  teamLabel: string;
  messagePlaceholder: string;
  submitLabel: string;
};

const EXTRA_FR: ExtraField[] = [
  {
    id: 'organisation',
    label: 'Organisation',
    type: 'text',
    placeholder: 'Nom du fonds, family office ou entreprise…',
  },
  {
    id: 'investorType',
    label: "Type d'investisseur",
    type: 'select',
    placeholder: 'Sélectionner…',
    options: [
      { value: 'business_angel', label: 'Business Angel' },
      { value: 'family_office', label: 'Family Office' },
      { value: 'vc', label: 'Fonds de Venture Capital' },
      { value: 'corporate', label: 'Corporate / Investisseur Stratégique' },
      { value: 'other', label: 'Autre' },
    ],
  },
  {
    id: 'ticketSize',
    label: 'Ticket envisagé',
    type: 'select',
    placeholder: 'Sélectionner une fourchette…',
    options: [
      { value: 'lt100k', label: '< 100 000 €' },
      { value: '100k_500k', label: '100 000 € – 500 000 €' },
      { value: '500k_1m', label: '500 000 € – 1 000 000 €' },
      { value: '1m_5m', label: '1 000 000 € – 5 000 000 €' },
      { value: 'gt5m', label: '> 5 000 000 €' },
    ],
  },
];

const EXTRA_EN: ExtraField[] = [
  {
    id: 'organisation',
    label: 'Organisation',
    type: 'text',
    placeholder: 'Fund name, family office, or company…',
  },
  {
    id: 'investorType',
    label: 'Investor type',
    type: 'select',
    placeholder: 'Select…',
    options: [
      { value: 'business_angel', label: 'Angel investor' },
      { value: 'family_office', label: 'Family office' },
      { value: 'vc', label: 'Venture capital fund' },
      { value: 'corporate', label: 'Corporate / strategic' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'ticketSize',
    label: 'Ticket size',
    type: 'select',
    placeholder: 'Select a range…',
    options: [
      { value: 'lt100k', label: '< €100,000' },
      { value: '100k_500k', label: '€100,000 – €500,000' },
      { value: '500k_1m', label: '€500,000 – €1,000,000' },
      { value: '1m_5m', label: '€1,000,000 – €5,000,000' },
      { value: 'gt5m', label: '> €5,000,000' },
    ],
  },
];

const FR: InvestorsPublicContent = {
  extraFields: EXTRA_FR,
  kpis: [
    { value: '3 200+', label: 'Établissements actifs', trend: '+340% en 12 mois' },
    { value: '2,1M', label: "Avis traités par l'IA", trend: 'Depuis le lancement' },
    { value: '< 2%', label: 'Taux de churn mensuel', trend: 'Rétention de 98%' },
    { value: '€4,2M', label: 'ARR estimé T1 2026', trend: '+280% YoY' },
  ],
  market: [
    { value: '€12,4Md', label: 'Taille du marché EU (TAM)', desc: 'Gestion de réputation & Review Management en Europe' },
    { value: '€1,8Md', label: 'Marché adressable (SAM)', desc: 'TPE/PME multi-plateformes en France, DE, ES, IT, BE' },
    { value: '€240M', label: 'Objectif SOM à 3 ans', desc: 'Part de marché cible selon notre modèle de croissance bottom-up' },
  ],
  differentiators: [
    {
      iconKey: 'brain',
      title: 'IA propriétaire haute précision',
      description:
        "Contrairement aux solutions génériques, REPUTEXA dispose d'un moteur NLP spécialisé sur les avis commerciaux, fine-tuné sur 2,1M d'exemples réels. Notre Shield Center atteint 97,4% de précision — bien au-delà des standards du marché.",
    },
    {
      iconKey: 'shield',
      title: 'Shield Center — avantage défensif unique',
      description:
        "Notre technologie de détection de faux avis et de contestation automatisée auprès des plateformes n'a pas d'équivalent direct en Europe. Nous sommes les seuls à combiner cette capacité avec la génération de réponses IA dans une interface unifiée.",
    },
    {
      iconKey: 'layers',
      title: 'Modèle SaaS récurrent haute rétention',
      description:
        "Avec un churn mensuel inférieur à 2% et un NPS de 72, REPUTEXA bénéficie d'une rétention exceptionnelle dans le segment B2B SaaS. Le temps moyen de valeur client (LTV) est de 28 mois.",
    },
    {
      iconKey: 'globe',
      title: 'Expansion européenne structurée',
      description:
        "Notre playbook de go-to-market a été validé en France et en Belgique. L'ouverture de l'Espagne, l'Italie et l'Allemagne en 2026 s'appuie sur la même architecture multi-tenant et le même moteur IA, sans coûts de développement additionnels majeurs.",
    },
  ],
  roadmap: [
    {
      period: 'Q2 2026',
      milestones: [
        'Certification SOC 2 Type II',
        'Connecteurs POS natifs : Square, SumUp (AI Capture)',
        '5 000 établissements actifs',
        'Rapport de transparence public v1',
      ],
    },
    {
      period: 'Q3–Q4 2026',
      milestones: [
        'Ouverture des marchés DACH (Allemagne, Autriche, Suisse)',
        'API marketplace : connecteurs Salesforce, Zapier, Make',
        'Lancement de REPUTEXA Enterprise (grands comptes >50 sites)',
        'Premier partenariat revendeur (réseau de franchise)',
      ],
    },
    {
      period: '2027',
      milestones: [
        'Expansion UK post-DSA',
        'Lancement de REPUTEXA Intelligence — données agrégées et benchmarks sectoriels',
        '€20M ARR · 15 000 établissements actifs',
        'Envisageable : Série A ou rentabilité opérationnelle',
      ],
    },
  ],
  unitEconomics: [
    {
      metric: 'Plans tarifaires',
      value: '__PLAN_TRIO_EUR__',
      note: 'VISION / PULSE / ZENITH (par établissement, remise dégressives multi-sites)',
    },
    { metric: 'Remise multi-sites', value: '−20% à −50%', note: '2e établissement : −20% · 3e : −30% · 4e : −40% · 5e+ : −50%' },
    { metric: 'LTV estimée (24 mois)', value: '~€2 800', note: 'Basée sur ARPU pondéré et taux de churn < 2%/mois observé' },
    { metric: 'CAC moyen estimé', value: '~€380', note: 'Mix SEO organique + outbound + partenariats revendeurs' },
    { metric: 'Modèle de revenus', value: 'SaaS récurrent', note: 'Abonnements mensuels ou annuels (−20%) via Stripe' },
    { metric: 'Marges brutes estimées', value: '~78–82%', note: 'Coûts IA (Anthropic + OpenAI) + infrastructure Vercel/Supabase' },
  ],
  trustSignals: [
    'Infrastructure 100% hébergée en Union européenne (Paris + Francfort)',
    'Conformité RGPD certifiée — DPO désigné et registre des traitements tenu à jour',
    'Objectif certification SOC 2 Type II — feuille de route 2027',
    'Stripe + Supabase comme infrastructure de données de confiance (SOC 2, ISO 27001)',
    'Aucune donnée client vendue ou partagée avec des tiers',
    "Gouvernance : Conseil d'administration constitué, pacte d'associés en place",
  ],
  visionTitle: 'Notre vision',
  visionP1:
    "Devenir la couche d'intelligence réputationnelle standard de l'économie locale européenne — aussi indispensable que le PMS pour un hôtel ou le logiciel de caisse pour un restaurateur.",
  visionP2:
    "En 2028, nous visons 50 000 établissements actifs dans 12 pays européens, avec REPUTEXA Intelligence — notre offre de données agrégées — comme deuxième moteur de revenus à marges élevées. Le marché européen de la Review Management est fragmenté, sous-équipé en IA et en forte croissance : c'est précisément là que nous opérons.",
  marketTitle: 'Opportunité de marché',
  marketMacroLabel: 'Contexte macro :',
  marketMacroBody:
    "Le Digital Services Act (DSA) entré en vigueur en 2024 impose aux plateformes d'avis de nouvelles obligations de transparence et de lutte contre les faux avis. Cette réglementation crée une demande structurelle pour des outils de gestion de conformité comme REPUTEXA — et complexifie l'entrée de nouveaux acteurs non-européens.",
  diffTitle: 'Avantages compétitifs',
  unitTitle: 'Économie unitaire',
  roadmapTitle: 'Feuille de route',
  trustTitle: 'Gouvernance & Conformité',
  formHeading: "Contacter l'équipe Relations Investisseurs",
  formDescription:
    'Pitch deck, data room et one-pager financier disponibles sur demande sous NDA. Notre équipe vous répond sous 48h.',
  teamLabel: 'Notre équipe Relations Investisseurs',
  messagePlaceholder:
    "Présentez votre thèse d'investissement, vos questions sur la traction ou vos conditions habituelles…",
  submitLabel: 'Envoyer ma demande',
};

const EN: InvestorsPublicContent = {
  extraFields: EXTRA_EN,
  kpis: [
    { value: '3,200+', label: 'Active locations', trend: '+340% in 12 months' },
    { value: '2.1M', label: 'Reviews processed by AI', trend: 'Since launch' },
    { value: '<2%', label: 'Monthly churn', trend: '98% retention' },
    { value: '€4.2M', label: 'Est. ARR Q1 2026', trend: '+280% YoY' },
  ],
  market: [
    { value: '€12.4B', label: 'EU TAM', desc: 'Reputation & review management in Europe' },
    { value: '€1.8B', label: 'SAM', desc: 'Multi-platform SMBs in FR, DE, ES, IT, BE' },
    { value: '€240M', label: '3-year SOM target', desc: 'Bottom-up share from our growth model' },
  ],
  differentiators: [
    {
      iconKey: 'brain',
      title: 'Proprietary high-precision AI',
      description:
        'Unlike generic tools, REPUTEXA runs an NLP stack tuned on 2.1M real commercial reviews. Shield Center hits 97.4% precision—well above typical vendors.',
    },
    {
      iconKey: 'shield',
      title: 'Shield Center — rare defensive moat',
      description:
        'Fake-review detection plus automated dispute packs has no direct European peer. We pair it with AI replies in one product surface.',
    },
    {
      iconKey: 'layers',
      title: 'Recurring SaaS with elite retention',
      description:
        'Under 2% monthly churn and NPS 72 mean standout B2B SaaS retention. Average customer lifetime value ~28 months.',
    },
    {
      iconKey: 'globe',
      title: 'Structured EU expansion',
      description:
        'GTM playbook proven in France and Belgium. Spain, Italy, and Germany in 2026 reuse the same multi-tenant stack without major new R&D.',
    },
  ],
  roadmap: [
    {
      period: 'Q2 2026',
      milestones: [
        'SOC 2 Type II certification',
        'Native POS connectors: Square, SumUp (AI Capture)',
        '5,000 active locations',
        'Public transparency report v1',
      ],
    },
    {
      period: 'Q3–Q4 2026',
      milestones: [
        'DACH launch (DE, AT, CH)',
        'API marketplace: Salesforce, Zapier, Make',
        'REPUTEXA Enterprise (>50 sites)',
        'First reseller partnership (franchise network)',
      ],
    },
    {
      period: '2027',
      milestones: [
        'UK expansion post-DSA',
        'REPUTEXA Intelligence — aggregated data & sector benchmarks',
        '€20M ARR · 15,000 active locations',
        'Potential Series A or operating profitability',
      ],
    },
  ],
  unitEconomics: [
    {
      metric: 'Pricing tiers',
      value: '__PLAN_TRIO_EUR__',
      note: 'VISION / PULSE / ZENITH per location, tiered multi-site discounts',
    },
    { metric: 'Multi-site discount', value: '−20% to −50%', note: '2nd: −20% · 3rd: −30% · 4th: −40% · 5+: −50%' },
    { metric: 'Est. LTV (24 mo)', value: '~€2,800', note: 'Blended ARPU vs <2% monthly churn' },
    { metric: 'Est. average CAC', value: '~€380', note: 'Organic SEO + outbound + reseller mix' },
    { metric: 'Revenue model', value: 'Recurring SaaS', note: 'Monthly or annual (−20%) via Stripe' },
    { metric: 'Est. gross margin', value: '~78–82%', note: 'AI inference (Anthropic + OpenAI) + Vercel/Supabase' },
  ],
  trustSignals: [
    '100% EU-hosted infrastructure (Paris + Frankfurt)',
    'GDPR program — DPO appointed, Article 30 register maintained',
    'SOC 2 Type II targeted on roadmap to 2027',
    'Stripe + Supabase backbone (SOC 2, ISO 27001)',
    'No customer data sold or shared with third parties',
    'Governance: board in place, shareholder agreement executed',
  ],
  visionTitle: 'Our vision',
  visionP1:
    'Become the default reputation intelligence layer for European local commerce—as essential as a PMS for hotels or a POS for restaurants.',
  visionP2:
    'By 2028 we target 50,000 active locations across 12 EU countries, with REPUTEXA Intelligence (aggregated data) as a second high-margin revenue line. The EU review-management market is fragmented, under-automated, and growing—that is where we play.',
  marketTitle: 'Market opportunity',
  marketMacroLabel: 'Macro context:',
  marketMacroBody:
    'The Digital Services Act (2024) pushes review platforms toward transparency and fake-review enforcement. That structurally increases demand for compliance-ready tools like REPUTEXA—and raises barriers for non-EU entrants.',
  diffTitle: 'Competitive advantages',
  unitTitle: 'Unit economics',
  roadmapTitle: 'Roadmap',
  trustTitle: 'Governance & compliance',
  formHeading: 'Contact investor relations',
  formDescription: 'Pitch deck, data room, and financial one-pager available under NDA. We reply within 48 hours.',
  teamLabel: 'REPUTEXA investor relations',
  messagePlaceholder: 'Share your investment thesis, traction questions, or typical process…',
  submitLabel: 'Send request',
};

export function getInvestorsPublicContent(locale: string): InvestorsPublicContent {
  const base = locale === 'fr' ? FR : EN;
  const trio = formatPlanTrioCatalogEur();
  const unitEconomics = base.unitEconomics.map((row) =>
    row.value === '__PLAN_TRIO_EUR__' ? { ...row, value: trio } : row,
  );
  return { ...base, unitEconomics };
}
