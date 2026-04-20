/** Identifiants thème illustration (aperçu web — pas dans le .pkpass Apple). */
export const WALLET_THEME_IDS = [
  'bakery',
  'butcher',
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

export type WalletThemeIllustrationId = (typeof WALLET_THEME_IDS)[number];

export function isWalletThemeIllustrationId(s: string): s is WalletThemeIllustrationId {
  return (WALLET_THEME_IDS as readonly string[]).includes(s);
}

/** Chemin public `/wallet-pass-themes/{id}.svg` */
export function walletThemeIllustrationSrc(id: WalletThemeIllustrationId): string {
  return `/wallet-pass-themes/${id}.svg`;
}
