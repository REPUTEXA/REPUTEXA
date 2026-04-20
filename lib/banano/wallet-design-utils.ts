/** Normalise une couleur saisie (#hex ou rgb) pour pass.json Apple Wallet. */
export function normalizeWalletPassColor(input: string | null | undefined, fallbackRgb: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return fallbackRgb;
  if (raw.startsWith('rgb')) return raw;
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallbackRgb;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Formulaire / preview : valeur #rrgggb pour input type color. */
export function passColorToHex(input: string | null | undefined, fallbackHex: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return fallbackHex;
  if (raw.startsWith('#') && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  const m = raw.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (m) {
    const r = Math.min(255, Math.max(0, Number(m[1])));
    const g = Math.min(255, Math.max(0, Number(m[2])));
    const b = Math.min(255, Math.max(0, Number(m[3])));
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return fallbackHex;
}
