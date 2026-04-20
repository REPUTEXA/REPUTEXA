import sharp from 'sharp';
import {
  computeStripExtractRect,
  UNIVERSAL_STRIP_CROP_DEFAULT,
  WALLET_STRIP_ASPECT,
} from '@/lib/wallet/wallet-strip-crop';
import type { NormalizedRect, WalletStripCrop } from '@/lib/wallet/wallet-strip-crop';

/**
 * Dimensions Apple PassKit pour le strip d’une carte magasin (storeCard).
 * @see https://developer.apple.com/design/human-interface-guidelines/wallet
 */
export const WALLET_STRIP_DIMS = {
  /** @1x */
  w1: 375,
  h1: 123,
  /** @2x */
  w2: 750,
  h2: 246,
  /** @3x — rendu net sur iPhone Pro Max */
  w3: 1125,
  h3: 369,
} as const;

export type WalletStripBuffers = {
  strip1x: Buffer;
  strip2x: Buffer;
  strip3x: Buffer;
};

export type BuildWalletStripOptions = {
  crop?: WalletStripCrop | null;
  stripPreCrop?: NormalizedRect | null;
};

/**
 * Extrait la zone strip (focale + ROI métier) puis redimensionne aux trois densités PassKit.
 */
export async function buildWalletStripBuffersForPassKit(
  input: Buffer,
  opts?: BuildWalletStripOptions
): Promise<WalletStripBuffers | null> {
  if (!input || input.length < 32) return null;
  const crop = opts?.crop ?? UNIVERSAL_STRIP_CROP_DEFAULT;
  const pre = opts?.stripPreCrop ?? undefined;
  try {
    const meta = await sharp(input).rotate().metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (W < 8 || H < 8) return null;

    const rect = computeStripExtractRect(W, H, WALLET_STRIP_ASPECT, crop, pre);
    const { w1, h1, w2, h2, w3, h3 } = WALLET_STRIP_DIMS;

    const base = sharp(input).rotate().extract(rect);

    const [strip1x, strip2x, strip3x] = await Promise.all([
      base
        .clone()
        .resize(w1, h1, { fit: 'fill' })
        .png({ compressionLevel: 9, effort: 7 })
        .toBuffer(),
      base
        .clone()
        .resize(w2, h2, { fit: 'fill' })
        .png({ compressionLevel: 9, effort: 7 })
        .toBuffer(),
      base
        .clone()
        .resize(w3, h3, { fit: 'fill' })
        .png({ compressionLevel: 9, effort: 7 })
        .toBuffer(),
    ]);
    return { strip1x, strip2x, strip3x };
  } catch {
    return null;
  }
}
