'use strict';

/**
 * Icônes 16x16 discrètes (bitmap RGBA) pour la zone de notification.
 * @param {import('electron').NativeImage} nativeImage
 * @param {'ok' | 'error'} status
 */
function trayIconForStatus(nativeImage, status) {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const r = status === 'ok' ? 0x22 : 0xdc;
  const g = status === 'ok' ? 0xc5 : 0x26;
  const b = status === 'ok' ? 0x5e : 0x26;
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
    buf[o + 3] = 255;
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

module.exports = { trayIconForStatus };
