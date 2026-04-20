'use strict';

/**
 * Génère build/icon.ico (placeholder vert Reputexa) pour electron-builder.
 * Remplacez par votre .ico multi-résolution pour la prod (voir build/ICON.txt).
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const toIco = require('to-ico');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'icon.ico');
const SIZE = 256;
/** Couleur proche du bouton « primaire » de l’app (vert). */
const HEX = '#16a34a';

async function main() {
  const image = new Jimp(SIZE, SIZE, HEX);
  const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
  const icoBuffer = await toIco([pngBuffer], {
    sizes: [16, 24, 32, 48, 64, 128, 256],
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, icoBuffer);
  console.log('[generate-icon] Écrit :', OUT);
}

main().catch((e) => {
  console.error('[generate-icon]', e);
  process.exit(1);
});
