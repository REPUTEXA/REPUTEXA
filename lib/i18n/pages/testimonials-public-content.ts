import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';
import {
  TESTIMONIAL_LOCALE_PACKS,
  type TestimonialLocalePack,
} from '@/lib/i18n/pages/testimonials-locale-packs';

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  company: string;
  sector: string;
  location: string;
  rating: number;
  quote: string;
  result: string;
  plan: 'VISION' | 'PULSE' | 'ZENITH';
  featured?: boolean;
};

export type TestimonialsPublicContent = {
  items: Testimonial[];
  globalMetrics: { value: string; label: string }[];
  allSectorsLabel: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
};

const FR: TestimonialsPublicContent = {
  items: [
    {
      id: '1',
      name: 'Amélie Rousseau',
      role: 'Directrice générale',
      company: 'Groupe Hôtelier Azur',
      sector: 'Hôtellerie',
      location: 'Nice, France',
      rating: 5,
      quote:
        "Avant REPUTEXA, nous répondions à peine à 20% de nos avis Google. Aujourd'hui, 100% des avis reçoivent une réponse personnalisée dans les 24 heures. Notre note est passée de 3,8 à 4,7 étoiles en 4 mois. Le Shield Center a détecté une campagne de dénigrement coordonnée que nous n'aurions jamais repérée seuls.",
      result: '+0,9 étoile en 4 mois · Taux de réponse de 20% à 100%',
      plan: 'ZENITH',
      featured: true,
    },
    {
      id: '2',
      name: 'Thomas Bérard',
      role: 'Gérant',
      company: 'Brasserie Le Carré',
      sector: 'Restauration',
      location: 'Lyon, France',
      rating: 5,
      quote:
        "En tant que restaurateur, j'avais peur que les réponses IA sonnent faux. C'est tout l'inverse — nos clients pensent que c'est moi qui écris. L'IA capture parfaitement notre ton décontracté et bienveillant. On a économisé 8h de travail par semaine.",
      result: '8h/semaine économisées · Note : 4,2 → 4,6 étoiles',
      plan: 'PULSE',
    },
    {
      id: '3',
      name: 'Sarah Khalid',
      role: 'Responsable Marketing Digital',
      company: 'Clinique Esthétique Prima',
      sector: 'Santé & Bien-être',
      location: 'Paris, France',
      rating: 5,
      quote:
        'Le secteur médical est très sensible sur les avis. REPUTEXA nous permet de répondre avec le niveau de professionnalisme que nos patients attendent, tout en restant dans le cadre déontologique médical. Le filtre de conformité IA est remarquable.',
      result: 'Note : 4,0 → 4,8 étoiles · +23% de nouveaux patients référencés',
      plan: 'ZENITH',
    },
    {
      id: '4',
      name: 'Marc Fontaine',
      role: 'Directeur des Opérations',
      company: 'Réseau FLASH Coiffure (12 salons)',
      sector: 'Beauté',
      location: 'Île-de-France',
      rating: 5,
      quote:
        "Gérer 12 salons et leurs avis en même temps était un cauchemar. REPUTEXA centralise tout dans un seul dashboard. Le rapport mensuel que je reçois automatiquement me donne une vision parfaite de la réputation de chaque établissement. Un outil indispensable pour un réseau.",
      result: '12 établissements gérés · -90% de temps de gestion des avis',
      plan: 'ZENITH',
    },
    {
      id: '5',
      name: 'Isabelle Moreau',
      role: 'Propriétaire',
      company: "L'Atelier Fromager",
      sector: 'Commerce de proximité',
      location: 'Bordeaux, France',
      rating: 5,
      quote:
        "Je suis une petite boutique artisanale, pas une multinationale. REPUTEXA a été conçu pour des gens comme moi — simple à utiliser, abordable, et efficace. Mon score Google est passé de 4,1 à 4,9 étoiles. Mes clients viennent maintenant de toute la métropole bordelaise.",
      result: 'Note : 4,1 → 4,9 étoiles · Visibilité doublée sur Google Maps',
      plan: 'VISION',
    },
    {
      id: '6',
      name: 'Nicolas Duval',
      role: 'CEO',
      company: 'TechServ Solutions (100 clients B2B)',
      sector: 'Prestataire IT',
      location: 'Strasbourg, France',
      rating: 5,
      quote:
        "Nous avons intégré REPUTEXA via l'API dans notre CRM maison. En 2 jours d'intégration, chaque nouvel avis client déclenche automatiquement une suggestion de réponse dans notre workflow Salesforce. L'API est propre, documentée, et les webhooks fonctionnent parfaitement.",
      result: 'Intégration API en 2 jours · 100 clients gérés automatiquement',
      plan: 'ZENITH',
    },
    {
      id: '7',
      name: 'Fatima Benali',
      role: 'Directrice',
      company: "Résidence Les Jardins d'Or (EHPAD)",
      sector: 'Établissements de santé',
      location: 'Toulouse, France',
      rating: 5,
      quote:
        "Pour un EHPAD, la confiance des familles est primordiale. REPUTEXA nous aide à montrer notre réactivité et notre professionnalisme via nos réponses aux avis. Le programme Solidarité nous a permis d'accéder à la plateforme à tarif préférentiel. Un partenaire de confiance.",
      result: "Indice de confiance des familles : +41% · Taux d'occupation : +8%",
      plan: 'PULSE',
    },
    {
      id: '8',
      name: 'Alexandre Petit',
      role: 'Fondateur',
      company: 'Studio Yoga Zen',
      sector: 'Sport & Bien-être',
      location: 'Nantes, France',
      rating: 5,
      quote:
        "Mon studio yoga n'avait que 15 avis Google quand j'ai commencé REPUTEXA. En 6 mois, j'en ai 87, et ma note est à 4,9 étoiles. Le module de collecte d'avis QR code que j'affiche à la réception est un game-changer absolu.",
      result: '15 → 87 avis en 6 mois · Classement : 3ème à 1er sur Google Maps local',
      plan: 'ZENITH',
    },
    {
      id: '9',
      name: 'Claire Lefebvre',
      role: 'Responsable Communication',
      company: 'Chaîne de pharmacies Bien+ (8 officines)',
      sector: 'Pharmacie',
      location: 'Rhône-Alpes',
      rating: 5,
      quote:
        'Le Shield Center nous a alertés sur une série de faux avis négatifs qui ciblaient deux de nos officines — probablement une concurrence déloyale. REPUTEXA a généré les rapports de contestation Google en quelques clics. La plupart ont été retirés sous 72h.',
      result: '23 faux avis contestés et retirés · Réputation protégée sur 8 officines',
      plan: 'ZENITH',
    },
    {
      id: '10',
      name: 'Pierre Gautier',
      role: 'Directeur Général',
      company: 'Groupe Gautier Immobilier (5 agences)',
      sector: 'Immobilier',
      location: 'Paris, France',
      rating: 5,
      quote:
        "Dans l'immobilier, la confiance est tout. REPUTEXA nous a permis de construire une réputation en ligne qui reflète réellement la qualité de notre service. Notre taux de conversion des leads Google a augmenté de 31% depuis la mise en place d'une gestion active des avis.",
      result: '+31% de conversion leads Google · 5 agences harmonisées',
      plan: 'PULSE',
    },
  ],
  globalMetrics: [
    { value: '3 200+', label: 'Établissements actifs' },
    { value: '+0,7★', label: 'Gain de note moyen en 6 mois' },
    { value: '98%', label: 'Clients satisfaits ou très satisfaits' },
    { value: '4,9★', label: 'Note REPUTEXA sur G2' },
  ],
  allSectorsLabel: 'Tous les secteurs',
  ctaTitle: 'Rejoignez les 3 200+ établissements qui progressent',
  ctaBody:
    "14 jours d'essai gratuit, sans carte bancaire. Commencez à construire votre réputation dès aujourd'hui.",
  ctaButton: 'Démarrer gratuitement',
};

const EN: TestimonialsPublicContent = {
  items: [
    {
      id: '1',
      name: 'Amy Russell',
      role: 'CEO',
      company: 'Azur Hospitality Group',
      sector: 'Hospitality',
      location: 'San Diego, CA',
      rating: 5,
      quote:
        'Before REPUTEXA we replied to maybe 20% of Google reviews. Now 100% get a tailored answer within 24 hours. Our rating went from 3.8 to 4.7 in four months. Shield Center caught a coordinated smear campaign we would have missed alone.',
      result: '+0.9★ in 4 months · Response rate 20% → 100%',
      plan: 'ZENITH',
      featured: true,
    },
    {
      id: '2',
      name: 'James Mitchell',
      role: 'Owner',
      company: 'The Courtyard Brasserie',
      sector: 'Restaurants',
      location: 'Denver, CO',
      rating: 5,
      quote:
        "As a restaurateur I worried AI replies would sound fake. It's the opposite—guests think I wrote them. The tone matches our relaxed, friendly voice. We save about 8 hours a week.",
      result: '8h/week saved · Rating 4.2 → 4.6★',
      plan: 'PULSE',
    },
    {
      id: '3',
      name: 'Sarah Khalid',
      role: 'Digital marketing lead',
      company: 'Prima Aesthetic Clinic',
      sector: 'Health & wellness',
      location: 'Boston, MA',
      rating: 5,
      quote:
        'Healthcare is sensitive on reviews. REPUTEXA keeps replies professional and aligned with medical ethics. The compliance-aware AI filter is outstanding.',
      result: 'Rating 4.0 → 4.8★ · +23% referred new patients',
      plan: 'ZENITH',
    },
    {
      id: '4',
      name: 'Michael Foster',
      role: 'COO',
      company: 'FLASH Hair network (12 salons)',
      sector: 'Beauty',
      location: 'Greater London, UK',
      rating: 5,
      quote:
        'Managing twelve salons and their reviews was chaos. REPUTEXA centralizes everything. The monthly auto-report gives me a clear read on each location—essential for a chain.',
      result: '12 locations · ~90% less time on reviews',
      plan: 'ZENITH',
    },
    {
      id: '5',
      name: 'Emily Carter',
      role: 'Owner',
      company: 'The Village Cheese Shop',
      sector: 'Local retail',
      location: 'Portland, OR',
      rating: 5,
      quote:
        "I'm a small artisan shop, not a multinational. REPUTEXA is built for operators like me—simple, affordable, effective. Google went from 4.1 to 4.9★ and footfall grew across the metro area.",
      result: '4.1 → 4.9★ · Doubled Maps visibility',
      plan: 'VISION',
    },
    {
      id: '6',
      name: 'Ryan Cooper',
      role: 'CEO',
      company: 'TechServ Solutions (100 B2B accounts)',
      sector: 'IT services',
      location: 'Chicago, IL',
      rating: 5,
      quote:
        'We wired REPUTEXA into our in-house CRM via API. In two days every new review triggers a draft in our Salesforce flow. Clean docs, reliable webhooks.',
      result: 'API live in 2 days · 100 accounts automated',
      plan: 'ZENITH',
    },
    {
      id: '7',
      name: 'Priya Sharma',
      role: 'Director',
      company: 'Golden Gardens Care Home',
      sector: 'Healthcare facilities',
      location: 'Phoenix, AZ',
      rating: 5,
      quote:
        'For a care home, family trust matters. REPUTEXA shows we respond professionally. The solidarity pricing program made the platform accessible. A partner we rely on.',
      result: 'Family trust index +41% · Occupancy +8%',
      plan: 'PULSE',
    },
    {
      id: '8',
      name: 'Chris Jordan',
      role: 'Founder',
      company: 'Zen Yoga Studio',
      sector: 'Sports & wellness',
      location: 'Seattle, WA',
      rating: 5,
      quote:
        'We had 15 Google reviews when we started. Six months later: 87 reviews, 4.9★. The QR review collector at reception is a game changer.',
      result: '15 → 87 reviews in 6 months · #3 to #1 locally on Maps',
      plan: 'ZENITH',
    },
    {
      id: '9',
      name: 'Kate Morrison',
      role: 'Communications lead',
      company: 'Well+ Pharmacy chain (8 stores)',
      sector: 'Pharmacy',
      location: 'Northern California',
      rating: 5,
      quote:
        'Shield Center flagged a burst of fake negatives on two stores—likely unfair competition. REPUTEXA built Google dispute packs in clicks; most came down within 72 hours.',
      result: '23 fake reviews removed · 8 stores protected',
      plan: 'ZENITH',
    },
    {
      id: '10',
      name: 'Peter Grant',
      role: 'Managing director',
      company: 'Grant Real Estate Group (5 offices)',
      sector: 'Real estate',
      location: 'Miami, FL',
      rating: 5,
      quote:
        'Trust is everything in real estate. Active review management lifted Google lead conversion by 31% while keeping five agencies aligned.',
      result: '+31% Google lead conversion · 5 agencies in sync',
      plan: 'PULSE',
    },
  ],
  globalMetrics: [
    { value: '3,200+', label: 'Active locations' },
    { value: '+0.7★', label: 'Avg. rating lift in 6 months' },
    { value: '98%', label: 'Satisfied or very satisfied' },
    { value: '4.9★', label: 'REPUTEXA on G2' },
  ],
  allSectorsLabel: 'All sectors',
  ctaTitle: 'Join 3,200+ businesses that are growing their reputation',
  ctaBody: '14-day free trial, no card required. Start building trust today.',
  ctaButton: 'Start for free',
};

function applyTestimonialPack(
  base: TestimonialsPublicContent,
  pack: TestimonialLocalePack
): TestimonialsPublicContent {
  return {
    items: base.items.map((item, i) => ({ ...item, ...pack.partials[i] })),
    globalMetrics: pack.globalMetrics,
    allSectorsLabel: pack.allSectorsLabel,
    ctaTitle: pack.ctaTitle,
    ctaBody: pack.ctaBody,
    ctaButton: pack.ctaButton,
  };
}

const BY_LOCALE: Record<SiteLocaleCode, TestimonialsPublicContent> = {
  fr: FR,
  en: EN,
  'en-gb': EN,
  de: applyTestimonialPack(EN, TESTIMONIAL_LOCALE_PACKS.de!),
  es: applyTestimonialPack(EN, TESTIMONIAL_LOCALE_PACKS.es!),
  it: applyTestimonialPack(EN, TESTIMONIAL_LOCALE_PACKS.it!),
  pt: applyTestimonialPack(EN, TESTIMONIAL_LOCALE_PACKS.pt!),
  ja: applyTestimonialPack(EN, TESTIMONIAL_LOCALE_PACKS.ja!),
  zh: applyTestimonialPack(EN, TESTIMONIAL_LOCALE_PACKS.zh!),
};

export function getTestimonialsPublicContent(locale: string): TestimonialsPublicContent {
  const code = (SITE_LOCALE_CODES as readonly string[]).includes(locale)
    ? (locale as SiteLocaleCode)
    : 'en';
  return BY_LOCALE[code] ?? EN;
}
