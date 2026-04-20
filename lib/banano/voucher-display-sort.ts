/** Tri caisse / fiche : disponibles et expirés en haut (récent d’abord), utilisés en bas. */
export function sortVouchersForMerchantDisplay<
  T extends {
    status: string;
    created_at: string;
    redeemed_at?: string | null;
  },
>(rows: T[]): T[] {
  const rank = (s: string) => {
    if (s === 'available') return 0;
    if (s === 'expired') return 1;
    if (s === 'redeemed') return 2;
    return 3;
  };
  return [...rows].sort((a, b) => {
    const ra = rank(a.status);
    const rb = rank(b.status);
    if (ra !== rb) return ra - rb;
    const ta = new Date(
      a.status === 'redeemed' ? (a.redeemed_at ?? a.created_at) : a.created_at
    ).getTime();
    const tb = new Date(
      b.status === 'redeemed' ? (b.redeemed_at ?? b.created_at) : b.created_at
    ).getTime();
    return tb - ta;
  });
}
