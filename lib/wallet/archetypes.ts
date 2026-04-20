import { isWalletThemeIllustrationId } from '@/lib/banano/wallet-theme-illustrations';
import type { WalletThemeIllustrationId } from '@/lib/banano/wallet-theme-illustrations';
import { getWalletTradePresetById } from '@/lib/wallet/presets';
import type { WalletStampIconId } from '@/lib/wallet/presets';
import type { NormalizedRect, WalletStripCrop } from '@/lib/wallet/wallet-strip-crop';
import { UNIVERSAL_STRIP_CROP_DEFAULT } from '@/lib/wallet/wallet-strip-crop';
import { recommendedInactivityDaysForTrade } from '@/lib/wallet/themes';

/**
 * Archétypes visuels Reputexa : palettes, bandeaux SVG abstraits, tampon suggéré.
 * Upload strip HD optionnel côté commerçant (remplace le thème).
 */
export const WALLET_ARCHETYPE_IDS = [
  'butcher',
  'bakery',
  'cafe',
  'restaurant',
  'hair',
  'florist',
  'pharmacy',
  'garage',
  'beauty',
  'retail',
  'fitness',
  'hotel',
] as const;

export type WalletArchetypeId = (typeof WALLET_ARCHETYPE_IDS)[number];

export function isWalletArchetypeId(s: string): s is WalletArchetypeId {
  return (WALLET_ARCHETYPE_IDS as readonly string[]).includes(s);
}

export type WalletArchetype = {
  id: WalletArchetypeId;
  /** Illustration / bandeau source (thème SVG ou upload). */
  characterImageUrl: string;
  stripImageUrl: string;
  bg_color: string;
  text_color: string;
  label_color: string;
  stampIconId: WalletStampIconId;
  /** Tampons et points sont tous deux disponibles côté produit ; l’affichage suit le mode caisse / aperçu. */
  supported_modes: readonly ('stamps' | 'points')[];
  /** Suffixe clé i18n : `archetype_ambiance_${ambianceI18nSuffix}` */
  ambianceI18nSuffix: string;
  /** ROI 0-1 sur l’image source avant focale (ex. exclure le bas du personnage). */
  stripPreCrop?: NormalizedRect;
  /** Focale par défaut pour le strip (tête / buste). */
  defaultStripCrop: WalletStripCrop;
};

const MODES: readonly ('stamps' | 'points')[] = ['stamps', 'points'];

const svg = (id: string) => `/wallet-pass-themes/${id}.svg`;

export const WALLET_ARCHETYPES: readonly WalletArchetype[] = [
  {
    id: 'butcher',
    characterImageUrl: svg('butcher'),
    stripImageUrl: svg('butcher'),
    bg_color: '#800000',
    text_color: '#F5E6D3',
    label_color: '#D4A574',
    stampIconId: 'beef',
    supported_modes: MODES,
    ambianceI18nSuffix: 'butcher',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'bakery',
    characterImageUrl: svg('bakery'),
    stripImageUrl: svg('bakery'),
    bg_color: '#5c4033',
    text_color: '#fffbeb',
    label_color: '#fcd34d',
    stampIconId: 'sparkles',
    supported_modes: MODES,
    ambianceI18nSuffix: 'bakery',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'cafe',
    characterImageUrl: svg('cafe'),
    stripImageUrl: svg('cafe'),
    bg_color: '#292524',
    text_color: '#faf5f0',
    label_color: '#d6d3d1',
    stampIconId: 'coffee',
    supported_modes: MODES,
    ambianceI18nSuffix: 'cafe',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'restaurant',
    characterImageUrl: svg('restaurant'),
    stripImageUrl: svg('restaurant'),
    bg_color: '#431407',
    text_color: '#fff7ed',
    label_color: '#fdba74',
    stampIconId: 'heart',
    supported_modes: MODES,
    ambianceI18nSuffix: 'restaurant',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'hair',
    characterImageUrl: svg('hair'),
    stripImageUrl: svg('hair'),
    bg_color: '#1a1020',
    text_color: '#fdf2f8',
    label_color: '#fbcfe8',
    stampIconId: 'scissors',
    supported_modes: MODES,
    ambianceI18nSuffix: 'hair',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'florist',
    characterImageUrl: svg('florist'),
    stripImageUrl: svg('florist'),
    bg_color: '#14532d',
    text_color: '#ecfdf5',
    label_color: '#86efac',
    stampIconId: 'flower',
    supported_modes: MODES,
    ambianceI18nSuffix: 'florist',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'pharmacy',
    characterImageUrl: svg('pharmacy'),
    stripImageUrl: svg('pharmacy'),
    bg_color: '#0f172a',
    text_color: '#f8fafc',
    label_color: '#94a3b8',
    stampIconId: 'pill',
    supported_modes: MODES,
    ambianceI18nSuffix: 'pharmacy',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'garage',
    characterImageUrl: svg('garage'),
    stripImageUrl: svg('garage'),
    bg_color: '#4a5568',
    text_color: '#f7fafc',
    label_color: '#fb923c',
    stampIconId: 'dumbbell',
    supported_modes: MODES,
    ambianceI18nSuffix: 'garage',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'beauty',
    characterImageUrl: svg('beauty'),
    stripImageUrl: svg('beauty'),
    bg_color: '#1e1b4b',
    text_color: '#fdf4ff',
    label_color: '#e9d5ff',
    stampIconId: 'sparkles',
    supported_modes: MODES,
    ambianceI18nSuffix: 'beauty',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'retail',
    characterImageUrl: svg('retail'),
    stripImageUrl: svg('retail'),
    bg_color: '#171717',
    text_color: '#fafafa',
    label_color: '#a3a3a3',
    stampIconId: 'gift',
    supported_modes: MODES,
    ambianceI18nSuffix: 'retail',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'fitness',
    characterImageUrl: svg('fitness'),
    stripImageUrl: svg('fitness'),
    bg_color: '#0c1526',
    text_color: '#e0f2fe',
    label_color: '#38bdf8',
    stampIconId: 'dumbbell',
    supported_modes: MODES,
    ambianceI18nSuffix: 'fitness',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
  {
    id: 'hotel',
    characterImageUrl: svg('hotel'),
    stripImageUrl: svg('hotel'),
    bg_color: '#1c1409',
    text_color: '#fefce8',
    label_color: '#eab308',
    stampIconId: 'star',
    supported_modes: MODES,
    ambianceI18nSuffix: 'hotel',
    defaultStripCrop: UNIVERSAL_STRIP_CROP_DEFAULT,
  },
];

export function getWalletArchetypeById(id: string): WalletArchetype | undefined {
  return WALLET_ARCHETYPES.find((a) => a.id === id);
}

/** Couleurs + CSS d’aperçu issus du preset métier, surchargés par l’archétype. */
export function resolveArchetypeForDesigner(id: WalletArchetypeId): {
  archetype: WalletArchetype;
  custom_css: string | null;
  /** Id thème SVG /wallet-pass-themes/ quand l’archétype l’utilise. */
  themeIllustrationId: WalletThemeIllustrationId | null;
} {
  const archetype = getWalletArchetypeById(id)!;
  const preset = getWalletTradePresetById(id);
  const isBundledThemeSvg =
    archetype.characterImageUrl.endsWith('.svg') &&
    archetype.characterImageUrl.includes('/wallet-pass-themes/');
  const themeIllustrationId =
    isBundledThemeSvg && isWalletThemeIllustrationId(id) ? id : null;
  return {
    archetype,
    custom_css: preset?.custom_css ?? null,
    themeIllustrationId,
  };
}

/** Jours sans visite suggérés pour une première config « client perdu » (sans ligne en base). @see WALLET_ARCHETYPE_THEMES */
export function suggestedLostClientInactiveDaysForArchetype(
  archetypeId: string | null | undefined
): number {
  if (!archetypeId || !isWalletArchetypeId(archetypeId)) {
    return recommendedInactivityDaysForTrade(null);
  }
  return recommendedInactivityDaysForTrade(archetypeId);
}
