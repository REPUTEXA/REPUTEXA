import html2canvas from 'html2canvas';

/**
 * Rasterise le tampon (élément hors écran) en PNG pour export, presse-papiers ou pdf-lib.
 */
export async function captureBrandSealPngBytes(exportBoxId: string): Promise<Uint8Array> {
  const target = document.getElementById(exportBoxId);
  if (!target) {
    throw new Error('Brand seal export node missing');
  }
  const canvas = await html2canvas(target, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('Brand seal PNG blob failed');
  }
  return new Uint8Array(await blob.arrayBuffer());
}
