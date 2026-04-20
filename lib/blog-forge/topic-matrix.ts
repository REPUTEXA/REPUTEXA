/**
 * Matrice domaine × angle × secteur pour diversifier les sujets sur des décennies.
 * Tirage déterministe par semaine + index pour éviter les répétitions trop fréquentes.
 */

export const DOMAIN_POOL = [
  'Gastronomie & tables exigeantes',
  'Hôtellerie & expérience client',
  'Retail & commerce de proximité',
  'Santé, bien-être & confiance',
  'Immobilier & mandataires',
  'Artisanat & savoir-faire local',
  'E-commerce & marques D2C',
  'Services B2B & réputation corporate',
  'Tourisme & saisonnalité',
  'Automobile & mobilité',
] as const;

export const ANGLE_POOL = [
  'Psychologie de la critique en ligne',
  'Impact financier mesurable des avis',
  'Conformité & cadre légal (DSA, RGPD, plateformes)',
  'SEO local & visibilité Google Business',
  'WhatsApp & canaux de confiance',
  'Crise & communication de crise',
  'Fidélisation par la réponse aux avis',
  'Détection des avis frauduleux',
  'Culture d’équipe & charge mentale des équipes',
  'Benchmark sectoriel & cartographie concurrentielle',
] as const;

export const SECTOR_POOL = [
  'Restauration indépendante',
  'Boulangerie & pâtisserie',
  'Coiffure & salons',
  'Spa & instituts',
  'Cliniques & cabinets',
  'Agences immobilières',
  'Garages & carrossiers',
  'Hôtels & maisons d’hôtes',
  'Cavistes & commerce spécialisé',
  'SaaS & services numériques',
] as const;

export type TopicPick = {
  domain: string;
  angle: string;
  sector: string;
  weekIndex: number;
};

function hashWeek(weekMondayIso: string): number {
  let h = 0;
  for (let i = 0; i < weekMondayIso.length; i++) {
    h = (Math.imul(31, h) + weekMondayIso.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Tirage stable pour la semaine `weekMondayIso` (YYYY-MM-DD). */
export function pickTopicBundle(weekMondayIso: string): TopicPick {
  const h = hashWeek(weekMondayIso);
  const weekIndex = h % 10000;
  const domain = DOMAIN_POOL[h % DOMAIN_POOL.length];
  const angle = ANGLE_POOL[(h >> 3) % ANGLE_POOL.length];
  const sector = SECTOR_POOL[(h >> 7) % SECTOR_POOL.length];
  return { domain, angle, sector, weekIndex };
}
