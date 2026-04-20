import QRCode from 'qrcode';

/** PNG raster pour pdf-lib (navigateur). */
export async function qrPayloadToPngBytes(text: string, widthPx = 200): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(text, {
    width: widthPx,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0a0a0a', light: '#ffffff' },
  });
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}
