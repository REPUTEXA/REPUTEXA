/**
 * Empreinte navigateur déterministe (hash SHA-256 hex) pour anti-fraude Wallet.
 * Basée sur userAgent, résolution et densité d'écran (pas d'identifiant persistant tiers).
 */
export async function computeWalletDeviceFingerprintHex(): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return '';
  }
  const raw = [
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
    typeof window !== 'undefined' ? String(window.devicePixelRatio ?? 1) : '1',
  ].join('|');
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
