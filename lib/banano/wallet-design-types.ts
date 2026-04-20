import type { WalletStripCrop } from '@/lib/wallet/wallet-strip-crop';

export type WalletDesignPayload = {
  background_color: string | null;
  foreground_color: string | null;
  label_color: string | null;
  logo_text: string | null;
  logo_url: string | null;
  strip_image_url: string | null;
  custom_css: string | null;
  /** Thème illustration plein cadre (aperçu web uniquement). */
  theme_illustration_id: string | null;
  /** Icône tampon (aperçu, programme tampons). */
  stamp_icon_id: string | null;
  /** Archétype personnage Reputexa (butcher, bakery, …). */
  archetype_id: string | null;
  /** Aperçu designer : tampons ou points. Null = suit le mode fidélité caisse. */
  preview_balance_mode: 'stamps' | 'points' | null;
  /** Mode programme fidélité (lecture seule, depuis profiles). */
  loyalty_mode: 'stamps' | 'points';
  /** Recadrage strip (null = défaut archétype ou universel). */
  strip_crop: WalletStripCrop | null;
  establishment_name: string;
};
