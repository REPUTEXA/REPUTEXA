/** CSS injecté dans l’aperçu uniquement — garde-fous minimaux. */
const MAX_LEN = 8000;

const BLOCKED = /\burl\s*\(|@import|expression\s*\(|javascript:|on\w+\s*=|<\s*script|\\0\b|-moz-binding/i;

export function sanitizeWalletPreviewCss(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, MAX_LEN);
  if (!s) return null;
  if (BLOCKED.test(s)) return null;
  return s;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function parseSafeHex7(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;
  const t = input.trim();
  return HEX6.test(t) ? t.toLowerCase() : fallback;
}
