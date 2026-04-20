/**
 * Recadrage strip Wallet (PassKit 375×123 pt @1x) : même logique côté serveur (sharp) et aperçu (CSS).
 * Pré-recadrage optionnel (ROI métier, ex. retirer le bas d’un personnage) puis focale + zoom.
 */

export type WalletStripCrop = {
  focalX: number;
  focalY: number;
  /** >= 1 : zoom avant (réduit la fenêtre de recadrage). */
  zoom: number;
};

export type NormalizedRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Ratio largeur / hauteur du strip Apple storeCard @1x. */
export const WALLET_STRIP_ASPECT = 375 / 123;

export const UNIVERSAL_STRIP_CROP_DEFAULT: WalletStripCrop = {
  focalX: 0.5,
  focalY: 0.45,
  zoom: 1,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function clampWalletStripCrop(p: Partial<WalletStripCrop>): WalletStripCrop {
  return {
    focalX: clamp(Number.isFinite(p.focalX) ? (p.focalX as number) : 0.5, 0, 1),
    focalY: clamp(Number.isFinite(p.focalY) ? (p.focalY as number) : 0.45, 0, 1),
    zoom: clamp(Number.isFinite(p.zoom) ? (p.zoom as number) : 1, 1, 2),
  };
}

export function parseWalletStripCropJson(raw: unknown): WalletStripCrop | null {
  if (raw == null || raw === '') return null;
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  return clampWalletStripCrop({
    focalX: typeof o.focalX === 'number' ? o.focalX : Number(o.focalX),
    focalY: typeof o.focalY === 'number' ? o.focalY : Number(o.focalY),
    zoom: typeof o.zoom === 'number' ? o.zoom : Number(o.zoom),
  });
}

/**
 * Rectangle d’extraction (pixels entiers, coordonnées image source après rotation metadata sharp).
 */
export function computeStripExtractRect(
  imageWidth: number,
  imageHeight: number,
  stripAspect: number,
  crop: WalletStripCrop,
  preCrop: NormalizedRect | null | undefined
): { left: number; top: number; width: number; height: number } {
  const iw = Math.max(1, Math.floor(imageWidth));
  const ih = Math.max(1, Math.floor(imageHeight));

  const x0 = preCrop ? Math.round(preCrop.left * iw) : 0;
  const y0 = preCrop ? Math.round(preCrop.top * ih) : 0;
  const rw = preCrop ? Math.round(preCrop.width * iw) : iw;
  const rh = preCrop ? Math.round(preCrop.height * ih) : ih;

  const w = clamp(rw, 1, iw);
  const h = clamp(rh, 1, ih);

  const fx = x0 + clamp(crop.focalX, 0, 1) * w;
  const fy = y0 + clamp(crop.focalY, 0, 1) * h;

  const z = clamp(crop.zoom, 1, 2);

  let cw = Math.min(w, stripAspect * h);
  let ch = cw / stripAspect;
  if (ch > h) {
    ch = h;
    cw = stripAspect * ch;
  }
  if (cw > w) {
    cw = w;
    ch = cw / stripAspect;
  }

  cw /= z;
  ch /= z;

  cw = Math.max(1, Math.floor(cw));
  ch = Math.max(1, Math.floor(ch));

  let left = Math.round(fx - cw / 2);
  let top = Math.round(fy - ch / 2);

  left = clamp(left, x0, x0 + w - cw);
  top = clamp(top, y0, y0 + h - ch);

  return { left, top, width: cw, height: ch };
}
