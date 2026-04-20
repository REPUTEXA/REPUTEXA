import type { PlanSlug } from './pricing';

export type PlanDisplayConfig = {
  slug: PlanSlug;
  titleKey: string;
  descKey: string;
  featureKeys: string[];
  badgeKey: string | null;
  primary: boolean;
};

/** Ordre d’affichage : Vision, Pulse, Zenith. */
export const PLAN_ORDER: PlanSlug[] = ['vision', 'pulse', 'zenith'];

export const PLAN_DISPLAY_CONFIG: PlanDisplayConfig[] = [
  {
    slug: 'vision',
    titleKey: 'visionTitle',
    descKey: 'visionDesc',
    featureKeys: ['visionFeature1', 'visionFeature2', 'visionFeature3', 'visionFeature4', 'visionFeature5'],
    badgeKey: null,
    primary: false,
  },
  {
    slug: 'pulse',
    titleKey: 'pulseTitle',
    descKey: 'pulseDesc',
    featureKeys: [
      'pulseFeature1',
      'pulseFeature2',
      'pulseFeature3',
      'pulseFeature4',
      'pulseFeature5',
      'pulseFeature6',
      'pulseFeature7',
      'pulseFeature8',
    ],
    badgeKey: 'pulseBadge',
    primary: false,
  },
  {
    slug: 'zenith',
    titleKey: 'zenithTitle',
    descKey: 'zenithDesc',
    featureKeys: [
      'zenithFeature1',
      'zenithFeature2',
      'zenithFeature3',
      'zenithFeature4',
      'zenithFeature5',
      'zenithFeature6',
      'zenithFeature7',
      'zenithFeature8',
      'zenithFeature10',
    ],
    badgeKey: 'zenithBadge',
    primary: true,
  },
];
