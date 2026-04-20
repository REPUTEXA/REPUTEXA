import type { ExtraField } from '@/components/department-contact-form';

export type SecurityEncryptionIconKey = 'lock' | 'database' | 'server' | 'bot';
export type SecurityRgpdIconKey = 'userCheck' | 'fileText' | 'globe' | 'refreshCw';

export type SecurityEncryptionLayer = {
  iconKey: SecurityEncryptionIconKey;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  details: string[];
};

export type SecurityRgpdItem = {
  iconKey: SecurityRgpdIconKey;
  title: string;
  content: string;
};

export type SecurityTrustRow = { name: string; role: string; cert: string };

export type SecurityPublicContent = {
  legalExtraFields: ExtraField[];
  stackBadges: string[];
  registreSectionTitle: string;
  registreIntro: string;
  encryptionSectionTitle: string;
  encryptionLayers: SecurityEncryptionLayer[];
  vendorsTitle: string;
  vendorsIntro: string;
  trustStack: SecurityTrustRow[];
  vendorsFootnote: string;
  controlsTitle: string;
  controls: string[];
  rgpdSectionTitle: string;
  rgpdItems: SecurityRgpdItem[];
  formHeading: string;
  formDescription: string;
  teamLabel: string;
  messagePlaceholder: string;
  submitLabel: string;
  privacyLink: string;
};

const LEGAL_EXTRA_FR: ExtraField[] = [
  {
    id: 'requestType',
    label: 'Type de demande',
    type: 'select',
    placeholder: 'Sélectionner…',
    options: [
      { value: 'rgpd_rights', label: 'Exercice de droits RGPD (accès, rectification, suppression…)' },
      { value: 'vulnerability', label: 'Signalement de vulnérabilité (divulgation responsable)' },
      { value: 'legal_request', label: 'Demande légale ou judiciaire' },
      { value: 'dpa', label: "Demande d'accord de traitement des données (DPA)" },
      { value: 'other', label: 'Autre demande légale' },
    ],
  },
  {
    id: 'organisation',
    label: 'Organisation (optionnel)',
    type: 'text',
    placeholder: 'Entreprise, cabinet, autorité…',
    required: false,
  },
];

const LEGAL_EXTRA_EN: ExtraField[] = [
  {
    id: 'requestType',
    label: 'Request type',
    type: 'select',
    placeholder: 'Select…',
    options: [
      { value: 'rgpd_rights', label: 'GDPR rights request (access, rectification, erasure…)' },
      { value: 'vulnerability', label: 'Vulnerability report (responsible disclosure)' },
      { value: 'legal_request', label: 'Legal or court request' },
      { value: 'dpa', label: 'Data processing agreement (DPA)' },
      { value: 'other', label: 'Other legal request' },
    ],
  },
  {
    id: 'organisation',
    label: 'Organisation (optional)',
    type: 'text',
    placeholder: 'Company, firm, authority…',
    required: false,
  },
];

const ENCRYPTION_FR: SecurityEncryptionLayer[] = [
  {
    iconKey: 'lock',
    title: 'Chiffrement en transit',
    badge: 'TLS 1.3',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    description:
      "Toutes les communications entre votre navigateur et nos serveurs (Vercel Edge + Supabase) sont chiffrées avec TLS. Les protocoles obsolètes sont désactivés par défaut sur l'infrastructure Vercel et Supabase.",
    details: [
      'Certificats TLS gérés automatiquement par Vercel et Supabase',
      'HTTPS forcé sur toutes les routes — redirection HTTP → HTTPS',
      'Cloudflare en frontal pour toutes les requêtes entrants',
      'Communications IA via HTTPS vers Anthropic et OpenAI uniquement',
    ],
  },
  {
    iconKey: 'database',
    title: 'Chiffrement au repos',
    badge: 'PostgreSQL + Supabase',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    description:
      "Toutes vos données (avis, réponses, profils, historiques) sont stockées dans Supabase (PostgreSQL) avec chiffrement au repos activé par défaut sur l'infrastructure Supabase Cloud. La gestion des clés est assurée par Supabase.",
    details: [
      'Supabase Cloud — chiffrement au repos activé nativement',
      'Row Level Security (RLS) : chaque client ne peut lire que ses propres données',
      'Isolation complète des données par tenant (user_id sur toutes les tables)',
      'Sauvegardes automatiques chiffrées (Supabase gère la rotation)',
    ],
  },
  {
    iconKey: 'server',
    title: 'Infrastructure & Hébergement',
    badge: 'Vercel + Cloudflare',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    description:
      "L'application REPUTEXA est déployée sur Vercel Edge Network. Cloudflare fournit le CDN, le WAF et la protection DDoS. La base de données Supabase est hébergée en Europe (région EU-West-1).",
    details: [
      'Vercel Edge Network — déploiement serverless, zéro downtime',
      'Cloudflare WAF — filtrage des requêtes malveillantes',
      'Supabase EU-West-1 (Europe) — conformité RGPD',
      'Twilio (WhatsApp/SMS) et Resend (email) — fournisseurs SOC 2 certifiés',
    ],
  },
  {
    iconKey: 'bot',
    title: 'Protection anti-bot',
    badge: 'Cloudflare Turnstile',
    badgeColor: 'bg-amber-500/20 text-amber-400',
    description:
      "Cloudflare Turnstile est intégré sur toutes les actions sensibles (inscription, contact, génération de token). Il bloque les bots et les attaques par brute force sans friction pour les utilisateurs légitimes.",
    details: [
      "Turnstile actif sur l'inscription, la connexion et le formulaire de contact",
      'Rate limiting en mémoire : 5 requêtes/min (auth), 10 requêtes/min (contact)',
      'Vérification côté serveur sur chaque requête sensible',
      'Aucun tracking publicitaire — Turnstile respecte la vie privée',
    ],
  },
];

const ENCRYPTION_EN: SecurityEncryptionLayer[] = [
  {
    iconKey: 'lock',
    title: 'Encryption in transit',
    badge: 'TLS 1.3',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    description:
      'All traffic between your browser and our servers (Vercel Edge + Supabase) uses TLS. Legacy protocols are disabled by default on Vercel and Supabase.',
    details: [
      'TLS certificates auto-managed by Vercel and Supabase',
      'HTTPS enforced everywhere—HTTP redirects to HTTPS',
      'Cloudflare in front of inbound requests',
      'AI calls over HTTPS to Anthropic and OpenAI only',
    ],
  },
  {
    iconKey: 'database',
    title: 'Encryption at rest',
    badge: 'PostgreSQL + Supabase',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    description:
      'Customer data lives in Supabase PostgreSQL with at-rest encryption enabled on Supabase Cloud. Key management is handled by Supabase.',
    details: [
      'Supabase Cloud native at-rest encryption',
      'Row Level Security: each tenant reads only their rows',
      'Tenant isolation via user_id on all business tables',
      'Encrypted automated backups with rotation managed by Supabase',
    ],
  },
  {
    iconKey: 'server',
    title: 'Infrastructure & hosting',
    badge: 'Vercel + Cloudflare',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    description:
      'REPUTEXA runs on Vercel Edge. Cloudflare provides CDN, WAF, and DDoS protection. The database is hosted in Europe (EU-West-1).',
    details: [
      'Vercel Edge—serverless deploys, zero-downtime cuts',
      'Cloudflare WAF filters malicious requests',
      'Supabase EU-West-1—GDPR-aligned region',
      'Twilio (WhatsApp/SMS) and Resend (email)—SOC 2 certified vendors',
    ],
  },
  {
    iconKey: 'bot',
    title: 'Bot protection',
    badge: 'Cloudflare Turnstile',
    badgeColor: 'bg-amber-500/20 text-amber-400',
    description:
      'Cloudflare Turnstile protects sensitive flows (signup, contact, token generation), blocking bots and credential stuffing with low friction for humans.',
    details: [
      'Turnstile on signup, login, and contact',
      'In-memory rate limits: 5 req/min (auth), 10 req/min (contact)',
      'Server-side verification on sensitive actions',
      'Privacy-friendly—no ad tracking footprint',
    ],
  },
];

const RGPD_FR: SecurityRgpdItem[] = [
  {
    iconKey: 'userCheck',
    title: 'Responsable du traitement',
    content:
      "REPUTEXA agit comme responsable du traitement pour vos données personnelles (nom, email, téléphone, établissement). Pour les avis et données de vos clients finaux que vous gérez via notre plateforme, REPUTEXA agit comme sous-traitant.",
  },
  {
    iconKey: 'fileText',
    title: 'Base légale du traitement',
    content:
      "Le traitement de vos données repose sur l'exécution du contrat (fonctionnement de la plateforme), l'intérêt légitime (sécurité, prévention de la fraude) et, pour les communications marketing, votre consentement explicite.",
  },
  {
    iconKey: 'globe',
    title: 'Durée de conservation',
    content:
      'Vos données sont conservées pendant la durée de votre abonnement actif + 12 mois. Les données de facturation sont conservées 10 ans (obligations légales françaises). Toutes les autres données peuvent être supprimées sur demande sous 30 jours.',
  },
  {
    iconKey: 'refreshCw',
    title: 'Vos droits',
    content:
      "Conformément au RGPD (articles 15–22), vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez ces droits par email à legal@reputexa.fr — réponse sous 30 jours maximum.",
  },
];

const RGPD_EN: SecurityRgpdItem[] = [
  {
    iconKey: 'userCheck',
    title: 'Controller vs processor',
    content:
      'REPUTEXA is the controller for your account data (name, email, phone, business). For end-customer review data you manage in the product, REPUTEXA acts as a processor on your instructions.',
  },
  {
    iconKey: 'fileText',
    title: 'Legal bases',
    content:
      'Processing relies on contract performance (running the service), legitimate interest (security, fraud prevention), and—where required—your explicit consent for marketing.',
  },
  {
    iconKey: 'globe',
    title: 'Retention',
    content:
      'Data is kept for the life of your subscription plus 12 months. Billing records are retained 10 years (French law). Other data can be erased on request within 30 days.',
  },
  {
    iconKey: 'refreshCw',
    title: 'Your rights',
    content:
      'Under GDPR (Articles 15–22) you may request access, rectification, erasure, portability, and objection. Email legal@reputexa.fr—we respond within 30 days.',
  },
];

const TRUST_STACK_FR: SecurityTrustRow[] = [
  { name: 'Supabase Cloud', role: 'Base de données PostgreSQL', cert: 'SOC 2 Type II, ISO 27001' },
  { name: 'Vercel', role: 'Hébergement & Edge Network', cert: 'SOC 2 Type II' },
  { name: 'Stripe', role: 'Paiements (aucune CB chez REPUTEXA)', cert: 'PCI DSS Level 1, SOC 2' },
  { name: 'Twilio', role: 'WhatsApp & SMS', cert: 'SOC 2 Type II, ISO 27001' },
  { name: 'Resend', role: 'Emails transactionnels', cert: 'SOC 2 Type II' },
  { name: 'Cloudflare', role: 'CDN, WAF, Turnstile', cert: 'SOC 2 Type II, ISO 27001' },
];

const TRUST_STACK_EN: SecurityTrustRow[] = [
  { name: 'Supabase Cloud', role: 'PostgreSQL database', cert: 'SOC 2 Type II, ISO 27001' },
  { name: 'Vercel', role: 'Hosting & edge network', cert: 'SOC 2 Type II' },
  { name: 'Stripe', role: 'Payments (no card data at REPUTEXA)', cert: 'PCI DSS Level 1, SOC 2' },
  { name: 'Twilio', role: 'WhatsApp & SMS', cert: 'SOC 2 Type II, ISO 27001' },
  { name: 'Resend', role: 'Transactional email', cert: 'SOC 2 Type II' },
  { name: 'Cloudflare', role: 'CDN, WAF, Turnstile', cert: 'SOC 2 Type II, ISO 27001' },
];

const FR: SecurityPublicContent = {
  legalExtraFields: LEGAL_EXTRA_FR,
  stackBadges: [
    'Supabase PostgreSQL',
    'Vercel Edge',
    'Cloudflare WAF',
    'Turnstile Anti-bot',
    'TLS en transit',
    'RLS PostgreSQL',
    'RGPD Conforme',
    'Stripe PCI DSS',
  ],
  registreSectionTitle: 'Sécurité & RGPD',
  registreIntro:
    'Transparence sur les traitements : registre des activités de traitement (article 30 RGPD), formats CSV et HTML pour votre dossier conformité, alignés sur notre politique de confidentialité.',
  encryptionSectionTitle: 'Architecture de sécurité',
  encryptionLayers: ENCRYPTION_FR,
  vendorsTitle: 'Fournisseurs & Certifications',
  vendorsIntro:
    "REPUTEXA s'appuie sur des fournisseurs d'infrastructure déjà certifiés SOC 2 Type II et/ou ISO 27001. Leurs certifications s'appliquent à la couche sur laquelle vos données transitent ou sont stockées.",
  trustStack: TRUST_STACK_FR,
  vendorsFootnote:
    "REPUTEXA lui-même n'est pas certifié SOC 2 à ce stade. Cette certification figure dans notre feuille de route pour 2027.",
  controlsTitle: 'Contrôles de sécurité applicatifs',
  controls: [
    'Authentification Supabase avec session sécurisée (cookie HttpOnly) — expiration automatique',
    'Row Level Security activé sur toutes les tables — isolation complète des données client',
    "Vérification Cloudflare Turnstile sur l'inscription, la connexion et les formulaires sensibles",
    "Rate limiting IP-based sur toutes les routes API publiques (5–10 req/min selon l'endpoint)",
    'Validation Zod côté serveur sur tous les inputs avant traitement',
    'Les clés API IA (Anthropic, OpenAI) ne sont jamais exposées côté client',
    'Les tokens OAuth Google sont stockés de façon chiffrée dans la base Supabase',
    'Aucune donnée de carte bancaire stockée chez REPUTEXA — paiements 100% délégués à Stripe',
  ],
  rgpdSectionTitle: 'Conformité RGPD',
  rgpdItems: RGPD_FR,
  formHeading: 'Équipe Legal & Sécurité',
  formDescription:
    'Demandes RGPD, signalement de vulnérabilité (divulgation responsable), demandes judiciaires. Délai de réponse : 48h ouvrées.',
  teamLabel: 'Notre équipe Legal & Sécurité',
  messagePlaceholder: 'Décrivez précisément votre demande, les données concernées et votre contexte…',
  submitLabel: 'Envoyer ma demande',
  privacyLink: 'Lire notre politique de confidentialité complète →',
};

const EN: SecurityPublicContent = {
  legalExtraFields: LEGAL_EXTRA_EN,
  stackBadges: [
    'Supabase PostgreSQL',
    'Vercel Edge',
    'Cloudflare WAF',
    'Turnstile anti-bot',
    'TLS in transit',
    'PostgreSQL RLS',
    'GDPR aligned',
    'Stripe PCI DSS',
  ],
  registreSectionTitle: 'Security & GDPR',
  registreIntro:
    'Processing transparency: Article 30 GDPR register in CSV and HTML for your compliance file, aligned with our privacy policy.',
  encryptionSectionTitle: 'Security architecture',
  encryptionLayers: ENCRYPTION_EN,
  vendorsTitle: 'Vendors & certifications',
  vendorsIntro:
    'REPUTEXA builds on infrastructure vendors that already maintain SOC 2 Type II and/or ISO 27001. Their certifications cover the layers where your data transits or is stored.',
  trustStack: TRUST_STACK_EN,
  vendorsFootnote:
    'REPUTEXA itself is not SOC 2 certified yet—that milestone is on our roadmap toward 2027.',
  controlsTitle: 'Application security controls',
  controls: [
    'Supabase authentication with HttpOnly session cookies—automatic expiry',
    'Row Level Security on every table—strict tenant isolation',
    'Cloudflare Turnstile on signup, login, and sensitive forms',
    'IP-based rate limits on public API routes (5–10 req/min per route)',
    'Server-side Zod validation on all inputs',
    'Anthropic/OpenAI API keys never exposed to the browser',
    'Google OAuth tokens stored encrypted in Supabase',
    'No cardholder data at REPUTEXA—100% delegated to Stripe',
  ],
  rgpdSectionTitle: 'GDPR compliance',
  rgpdItems: RGPD_EN,
  formHeading: 'Legal & security team',
  formDescription:
    'GDPR requests, responsible vulnerability disclosure, and court orders. We reply within 48 business hours.',
  teamLabel: 'REPUTEXA legal & security',
  messagePlaceholder: 'Describe your request, impacted data, and context…',
  submitLabel: 'Send request',
  privacyLink: 'Read the full privacy policy →',
};

export function getSecurityPublicContent(locale: string): SecurityPublicContent {
  return locale === 'fr' ? FR : EN;
}
