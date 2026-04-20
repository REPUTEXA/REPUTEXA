import { WALLET_INDUSTRY_PRESETS } from '@/lib/banano/wallet-design-presets';

/**
 * Icônes tampon disponibles dans le designer (aperçu, futur rendu caisse).
 */
export const WALLET_STAMP_ICON_IDS = [
  'star',
  'heart',
  'coffee',
  'beef',
  'scissors',
  'sparkles',
  'pill',
  'flower',
  'dumbbell',
  'gift',
] as const;

export type WalletStampIconId = (typeof WALLET_STAMP_ICON_IDS)[number];

export function isWalletStampIconId(s: string): s is WalletStampIconId {
  return (WALLET_STAMP_ICON_IDS as readonly string[]).includes(s);
}

const TRADE_DEFAULT_STAMP: Record<string, WalletStampIconId> = {
  bakery: 'sparkles',
  butcher: 'beef',
  cafe: 'coffee',
  restaurant: 'heart',
  hair: 'scissors',
  florist: 'flower',
  pharmacy: 'pill',
  garage: 'dumbbell',
  beauty: 'sparkles',
  retail: 'gift',
  fitness: 'dumbbell',
  hotel: 'star',
};

/**
 * Univers métier : couleurs Apple Wallet, bandeau strip (SVG public), tampon suggéré.
 * Style produit « BF174C » : accent UI via sélection (pas une couleur imposée au pass).
 */
export type WalletTradePreset = {
  id: string;
  /** Bandeau strip PassKit / aperçu (même actif vectoriel que l’illustration plein cadre). */
  strip_url: string;
  bg_color: string;
  text_color: string;
  label_color: string;
  custom_css: string | null;
  default_stamp_icon: WalletStampIconId;
};

export const WALLET_TRADE_PRESETS: readonly WalletTradePreset[] = WALLET_INDUSTRY_PRESETS.map((p) => ({
  id: p.id,
  strip_url: `/wallet-pass-themes/${p.id}.svg`,
  bg_color: p.background_color,
  text_color: p.foreground_color,
  label_color: p.label_color,
  custom_css: p.custom_css,
  default_stamp_icon: TRADE_DEFAULT_STAMP[p.id] ?? 'star',
}));

export function getWalletTradePresetById(id: string): WalletTradePreset | undefined {
  return WALLET_TRADE_PRESETS.find((x) => x.id === id);
}
