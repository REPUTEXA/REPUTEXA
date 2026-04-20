import type { ExtraField } from '@/components/department-contact-form';

export type CareersJobIconKey = 'brain' | 'barChart2' | 'code' | 'trendingUp' | 'globe' | 'shield';
export type CareersBenefitIconKey = 'laptop' | 'zap' | 'graduationCap' | 'heart' | 'coffee' | 'trendingUp';

export type CareersJob = {
  id: string;
  iconKey: CareersJobIconKey;
  title: string;
  department: string;
  location: string;
  type: string;
  level: string;
  description: string;
  tags: string[];
};

export type CareersBenefit = { iconKey: CareersBenefitIconKey; title: string; description: string };

export type CareersPublicContent = {
  jobs: CareersJob[];
  benefits: CareersBenefit[];
  metrics: { value: string; label: string }[];
  extraFields: ExtraField[];
  cultureTitle: string;
  cultureP1: string;
  cultureP2: string;
  openRolesTitle: string;
  applyCta: string;
  benefitsTitle: string;
  formTitle: string;
  formIntro: string;
  formHeading: string;
  formDescription: string;
  teamLabel: string;
  messagePlaceholder: string;
  submitLabel: string;
  attachmentLabel: string;
  recruitmentNoticeTitle: string;
  recruitmentNoticeBody: string;
};

const JOBS_FR: CareersJob[] = [
  {
    id: 'ml-engineer',
    iconKey: 'brain',
    title: 'Senior ML Engineer — NLP & Réputation',
    department: 'Intelligence Artificielle',
    location: 'Paris ou Remote (EU)',
    type: 'CDI Temps plein',
    level: 'Senior (5+ ans)',
    description:
      "Vous concevez et optimisez nos modèles de traitement du langage naturel pour l'analyse de sentiments, la détection de toxicité et la génération de réponses contextuelles. Vous travaillez en étroite collaboration avec nos équipes produit et data.",
    tags: ['Python', 'PyTorch', 'Claude API', 'HuggingFace', 'MLflow'],
  },
  {
    id: 'data-scientist',
    iconKey: 'barChart2',
    title: 'Data Scientist — Réputation & Prédiction',
    department: 'Data',
    location: 'Paris ou Remote (EU)',
    type: 'CDI Temps plein',
    level: 'Mid-Senior (3+ ans)',
    description:
      "Vous développez des modèles prédictifs pour anticiper l'évolution de la réputation de nos clients, identifier les patterns d'avis frauduleux et optimiser nos algorithmes de scoring. Vous transformez la donnée brute en insights actionnables.",
    tags: ['Python', 'SQL', 'dbt', 'Scikit-learn', 'Supabase'],
  },
  {
    id: 'fullstack-engineer',
    iconKey: 'code',
    title: 'Fullstack Engineer — Produit IA',
    department: 'Ingénierie',
    location: 'Paris ou Remote (EU)',
    type: 'CDI Temps plein',
    level: 'Mid-Senior (3+ ans)',
    description:
      'Vous construisez les fonctionnalités qui font la différence pour nos clients. Stack Next.js 14, TypeScript, Supabase, Stripe. Vous êtes autonome, soucieux du détail UI et passionné par les produits B2B SaaS.',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'Tailwind CSS', 'Stripe'],
  },
  {
    id: 'growth-manager',
    iconKey: 'trendingUp',
    title: 'Growth Manager B2B',
    department: 'Croissance',
    location: 'Paris (présentiel 2j/sem)',
    type: 'CDI Temps plein',
    level: 'Mid (2+ ans en B2B SaaS)',
    description:
      "Vous pilotez l'acquisition et la rétention de nos clients PME et grands comptes. SEO, content, outbound, partenariats — vous maîtrisez les leviers growth B2B et travaillez avec une forte autonomie sur des OKRs ambitieux.",
    tags: ['SEO', 'HubSpot', 'LinkedIn Ads', 'Data-driven', 'Outbound'],
  },
  {
    id: 'solutions-engineer',
    iconKey: 'globe',
    title: 'Solutions Engineer — Intégrations',
    department: 'Ingénierie',
    location: 'Remote (EU)',
    type: 'CDI Temps plein',
    level: 'Mid (2+ ans)',
    description:
      "Vous êtes le pont entre notre produit et nos clients techniques. Vous accompagnez les intégrations API, développez des connecteurs sur-mesure et contribuez à la qualité de notre documentation développeur.",
    tags: ['REST API', 'Webhooks', 'Node.js', 'Postman', 'Documentation'],
  },
  {
    id: 'security-engineer',
    iconKey: 'shield',
    title: 'Security Engineer',
    department: 'Sécurité',
    location: 'Paris ou Remote (EU)',
    type: 'CDI Temps plein',
    level: 'Senior (4+ ans)',
    description:
      'Vous pilotez notre programme de sécurité : audit SOC 2, pentests, gestion des vulnérabilités, conformité RGPD. Vous êtes le garant de la confiance que nos clients placent en nous pour protéger leurs données.',
    tags: ['SAST/DAST', 'RGPD', 'AWS Security', 'SOC 2', 'Supabase RLS'],
  },
];

const JOBS_EN: CareersJob[] = [
  {
    id: 'ml-engineer',
    iconKey: 'brain',
    title: 'Senior ML Engineer — NLP & reputation',
    department: 'Artificial intelligence',
    location: 'Paris or remote (EU)',
    type: 'Full-time permanent',
    level: 'Senior (5+ years)',
    description:
      'You design and improve our NLP stack for sentiment, toxicity detection, and contextual reply generation. You work closely with product and data.',
    tags: ['Python', 'PyTorch', 'Claude API', 'HuggingFace', 'MLflow'],
  },
  {
    id: 'data-scientist',
    iconKey: 'barChart2',
    title: 'Data Scientist — reputation & forecasting',
    department: 'Data',
    location: 'Paris or remote (EU)',
    type: 'Full-time permanent',
    level: 'Mid–senior (3+ years)',
    description:
      'You build predictive models for reputation trajectories, fraudulent-review patterns, and scoring—turning raw signals into actionable insight.',
    tags: ['Python', 'SQL', 'dbt', 'Scikit-learn', 'Supabase'],
  },
  {
    id: 'fullstack-engineer',
    iconKey: 'code',
    title: 'Fullstack engineer — AI product',
    department: 'Engineering',
    location: 'Paris or remote (EU)',
    type: 'Full-time permanent',
    level: 'Mid–senior (3+ years)',
    description:
      'You ship features customers feel every day: Next.js 14, TypeScript, Supabase, Stripe. You care about UI detail and B2B SaaS craft.',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'Tailwind CSS', 'Stripe'],
  },
  {
    id: 'growth-manager',
    iconKey: 'trendingUp',
    title: 'B2B growth manager',
    department: 'Growth',
    location: 'Paris (2 days on-site)',
    type: 'Full-time permanent',
    level: 'Mid (2+ years B2B SaaS)',
    description:
      'You own acquisition and retention for SMB and enterprise. SEO, content, outbound, partnerships—measurable OKRs, high autonomy.',
    tags: ['SEO', 'HubSpot', 'LinkedIn Ads', 'Data-driven', 'Outbound'],
  },
  {
    id: 'solutions-engineer',
    iconKey: 'globe',
    title: 'Solutions engineer — integrations',
    department: 'Engineering',
    location: 'Remote (EU)',
    type: 'Full-time permanent',
    level: 'Mid (2+ years)',
    description:
      'You are the bridge between product and technical customers: API rollouts, custom connectors, and developer-docs quality.',
    tags: ['REST API', 'Webhooks', 'Node.js', 'Postman', 'Documentation'],
  },
  {
    id: 'security-engineer',
    iconKey: 'shield',
    title: 'Security engineer',
    department: 'Security',
    location: 'Paris or remote (EU)',
    type: 'Full-time permanent',
    level: 'Senior (4+ years)',
    description:
      'You run our security program: SOC 2, pentests, vulnerability management, GDPR alignment—earning customer trust.',
    tags: ['SAST/DAST', 'GDPR', 'AWS Security', 'SOC 2', 'Supabase RLS'],
  },
];

const BENEFITS_FR: CareersBenefit[] = [
  {
    iconKey: 'laptop',
    title: 'Remote-first',
    description:
      "Travaillez où vous êtes le plus efficace — depuis Paris, Lyon, Bordeaux ou n'importe où en UE.",
  },
  {
    iconKey: 'zap',
    title: 'Stack dernière génération',
    description:
      "Next.js 14, Claude, Supabase, Vercel, TypeScript strict. Pas de legacy, que de l'innovation.",
  },
  {
    iconKey: 'graduationCap',
    title: 'Budget formation',
    description: '2 000€/an de budget formation pour conférences, cours en ligne et certifications.',
  },
  {
    iconKey: 'heart',
    title: 'Mutuelle premium',
    description: 'Mutuelle Alan Premium prise en charge à 100% — couverture santé de haut niveau.',
  },
  {
    iconKey: 'coffee',
    title: 'Équipe humaine',
    description:
      'Une équipe de 18 personnes passionnées. Décisions rapides, impact direct, culture bienveillante.',
  },
  {
    iconKey: 'trendingUp',
    title: 'BSPCE dès le premier jour',
    description: 'Tous nos collaborateurs bénéficient de BSPCE. Votre réussite est notre réussite.',
  },
];

const BENEFITS_EN: CareersBenefit[] = [
  {
    iconKey: 'laptop',
    title: 'Remote-first',
    description: 'Work where you are most effective—Paris, Lyon, Bordeaux, or anywhere in the EU.',
  },
  {
    iconKey: 'zap',
    title: 'Modern stack',
    description: 'Next.js 14, Claude, Supabase, Vercel, strict TypeScript—minimal legacy.',
  },
  {
    iconKey: 'graduationCap',
    title: 'Learning budget',
    description: '€2,000/year for conferences, courses, and certifications.',
  },
  {
    iconKey: 'heart',
    title: 'Premium health cover',
    description: 'Alan Premium health plan fully covered.',
  },
  {
    iconKey: 'coffee',
    title: 'Human team',
    description: '18 passionate people. Fast decisions, direct impact, kind culture.',
  },
  {
    iconKey: 'trendingUp',
    title: 'Equity from day one',
    description: 'Every teammate gets BSPCE-style equity—your win is our win.',
  },
];

const EXTRA_FR: ExtraField[] = [
  {
    id: 'position',
    label: 'Poste visé',
    type: 'select',
    placeholder: 'Sélectionner un poste…',
    options: [
      { value: 'ml_engineer', label: 'Senior ML Engineer — NLP & Réputation' },
      { value: 'data_scientist', label: 'Data Scientist — Réputation & Prédiction' },
      { value: 'fullstack', label: 'Fullstack Engineer — Produit IA' },
      { value: 'growth', label: 'Growth Manager B2B' },
      { value: 'solutions_engineer', label: 'Solutions Engineer — Intégrations' },
      { value: 'security', label: 'Security Engineer' },
      { value: 'spontaneous', label: 'Candidature spontanée' },
    ],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn ou Portfolio (optionnel)',
    type: 'url',
    placeholder: 'https://linkedin.com/in/votre-profil',
    required: false,
  },
];

const EXTRA_EN: ExtraField[] = [
  {
    id: 'position',
    label: 'Role',
    type: 'select',
    placeholder: 'Select a role…',
    options: [
      { value: 'ml_engineer', label: 'Senior ML engineer — NLP & reputation' },
      { value: 'data_scientist', label: 'Data scientist — reputation & prediction' },
      { value: 'fullstack', label: 'Fullstack engineer — AI product' },
      { value: 'growth', label: 'B2B growth manager' },
      { value: 'solutions_engineer', label: 'Solutions engineer — integrations' },
      { value: 'security', label: 'Security engineer' },
      { value: 'spontaneous', label: 'Open application' },
    ],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn or portfolio (optional)',
    type: 'url',
    placeholder: 'https://linkedin.com/in/your-profile',
    required: false,
  },
];

const FR: CareersPublicContent = {
  jobs: JOBS_FR,
  benefits: BENEFITS_FR,
  metrics: [
    { value: '18', label: 'Équipe actuelle' },
    { value: '6', label: 'Postes ouverts' },
    { value: '4,8★', label: 'Note Glassdoor' },
    { value: '12', label: 'Nationalités représentées' },
  ],
  extraFields: EXTRA_FR,
  cultureTitle: 'Notre mission, votre impact',
  cultureP1:
    "Chez REPUTEXA, nous croyons que la réputation numérique est un actif stratégique aussi précieux que les brevets ou la marque. Notre technologie protège des milliers d'établissements contre les campagnes de dénigrement, les faux avis et la désinformation — tout en les aidant à construire une e-réputation authentique et durable.",
  cultureP2:
    "Nous cherchons des profils qui partagent cette conviction : que l'IA, utilisée avec rigueur et éthique, peut avoir un impact profondément positif sur l'économie locale et la confiance numérique.",
  openRolesTitle: 'Postes ouverts',
  applyCta: 'Postuler',
  benefitsTitle: 'Ce que nous offrons',
  formTitle: 'Déposer ma candidature',
  formIntro:
    'Sélectionnez un poste ou choisissez « Candidature spontanée » si votre profil ne correspond à aucune offre ouverte.',
  formHeading: 'Département Recrutement',
  formDescription:
    'Notre équipe RH examine chaque candidature individuellement. Joignez votre CV ou portfolio en pièce jointe.',
  teamLabel: 'Notre équipe Recrutement',
  messagePlaceholder:
    "Présentez votre parcours, vos motivations pour rejoindre REPUTEXA et ce que vous apporteriez à l'équipe…",
  submitLabel: 'Envoyer ma candidature',
  attachmentLabel: 'CV / Portfolio (PDF, DOC, DOCX, image — optionnel)',
  recruitmentNoticeTitle: 'Processus de recrutement :',
  recruitmentNoticeBody:
    'Compte tenu du volume de candidatures, REPUTEXA applique une politique de « Silence vaut Refus ». Sans retour de notre part sous 15 jours ouvrés, veuillez considérer que votre profil n\'a pas été retenu pour cette session. Nous conservons toutefois votre CV dans notre vivier pour de futures opportunités.',
};

const EN: CareersPublicContent = {
  jobs: JOBS_EN,
  benefits: BENEFITS_EN,
  metrics: [
    { value: '18', label: 'People today' },
    { value: '6', label: 'Open roles' },
    { value: '4.8★', label: 'Glassdoor rating' },
    { value: '12', label: 'Nationalities' },
  ],
  extraFields: EXTRA_EN,
  cultureTitle: 'Our mission, your impact',
  cultureP1:
    'We believe online reputation is as strategic as patents or brand. Our technology protects thousands of businesses from smear campaigns, fake reviews, and disinformation—while helping them build an authentic reputation.',
  cultureP2:
    'We look for people who believe rigorous, ethical AI can strengthen local economies and digital trust.',
  openRolesTitle: 'Open roles',
  applyCta: 'Apply',
  benefitsTitle: 'What we offer',
  formTitle: 'Submit your application',
  formIntro: 'Pick a role or choose “Open application” if nothing fits exactly.',
  formHeading: 'Talent team',
  formDescription: 'Our recruiters review every application. Attach a CV or portfolio.',
  teamLabel: 'REPUTEXA talent team',
  messagePlaceholder: 'Tell us about your path, why REPUTEXA, and what you would bring to the team…',
  submitLabel: 'Send application',
  attachmentLabel: 'CV / portfolio (PDF, DOC, DOCX, image — optional)',
  recruitmentNoticeTitle: 'Hiring process:',
  recruitmentNoticeBody:
    'Because of application volume, REPUTEXA follows a “no news means no” policy. If you do not hear back within 15 business days, you were not selected for this round. We may keep your CV for future openings.',
};

export function getCareersPublicContent(locale: string): CareersPublicContent {
  return locale === 'fr' ? FR : EN;
}
