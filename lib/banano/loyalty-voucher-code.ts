/** Code public type VCHR- + 12 hex (collision faible ; réessai côté insert). */
export function generateBananoVoucherPublicCode(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  return `VCHR-${hex.toUpperCase()}`;
}

export function normalizeBananoVoucherCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}
