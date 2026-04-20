import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const STOP_FR = new Set([
  'avec',
  'sans',
  'pour',
  'dans',
  'chez',
  'sert',
  'noté',
  'achat',
  'visite',
  'client',
  'points',
  'tampons',
]);

export type LoyaltyBadge = {
  key: 'vip' | 'habitue' | 'danger' | 'nouveau';
  label: string;
  variant: 'vip' | 'habitue' | 'danger' | 'nouveau';
};

export type ReviewForSentiment = {
  rating: number;
  created_at: string;
};

/**
 * Percentile des visites (0–100) parmi les membres du commerçant (plus haut = plus actif).
 */
export function visitPercentile(myVisits: number, allVisitCounts: number[]): number {
  if (allVisitCounts.length === 0) return 50;
  const sorted = [...allVisitCounts].sort((a, b) => a - b);
  const n = sorted.length;
  const below = sorted.filter((v) => v < myVisits).length;
  const equal = sorted.filter((v) => v === myVisits).length;
  return Math.round(((below + equal / 2) / n) * 100);
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export function computeLoyaltyBadge(
  lifetimeVisits: number,
  visitPercentileScore: number,
  lastVisitAt: string | null | undefined,
  createdAt: string | null | undefined
): LoyaltyBadge {
  const dLast = daysSince(lastVisitAt);
  const dCreate = daysSince(createdAt);

  const inactiveTooLong =
    (dLast !== null && dLast >= 21) ||
    (dLast === null && dCreate !== null && dCreate >= 21 && lifetimeVisits > 0) ||
    (dLast === null && lifetimeVisits === 0 && dCreate !== null && dCreate >= 14);

  if (inactiveTooLong && lifetimeVisits >= 1) {
    return {
      key: 'danger',
      label: 'En danger (ne vient plus)',
      variant: 'danger',
    };
  }

  if (lifetimeVisits >= 3 && visitPercentileScore >= 95) {
    return { key: 'vip', label: 'VIP (Top 5 %)', variant: 'vip' };
  }

  if (lifetimeVisits >= 3) {
    return { key: 'habitue', label: 'Habitué', variant: 'habitue' };
  }

  return { key: 'nouveau', label: 'Nouveau / occasionnel', variant: 'nouveau' };
}

/** Notes issues des événements « achat » (earn avec note caisse). */
export function extractPurchaseNotes(
  events: Array<{ event_type: string; note: string | null }>
): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.event_type !== 'earn_points' && e.event_type !== 'earn_stamps') continue;
    const n = (e.note ?? '').trim();
    if (n) out.push(n);
  }
  return out;
}

export function buildIaSuggestion(
  firstName: string,
  notes: string[]
): string | null {
  const prenom = firstName.trim() || 'Ce client';
  if (notes.length === 0) {
    return null;
  }
  const words = notes
    .join(' ')
    .toLowerCase()
    .replace(/[0-9×x]+/g, ' ')
    .split(/[\s,.;:!?]+/)
    .map((w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .filter((w) => w.length > 3 && !STOP_FR.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  let top = '';
  let topN = 0;
  for (const [w, n] of freq) {
    if (n > topN) {
      top = w;
      topN = n;
    }
  }

  if (topN >= 2 && top) {
    return `${prenom} achète souvent des articles liés à « ${top} » — proposez-lui une nouveauté ou un pack découverte !`;
  }

  const sample = notes[0];
  if (sample.length > 120) {
    return `D’après les notes de caisse (« ${sample.slice(0, 100)}… »), ${prenom} pourrait apprécier une suggestion personnalisée en boutique.`;
  }
  return `D’après les notes (« ${sample} »), proposez un complément ou une nouveauté phare.`;
}

export function buildSentimentLine(reviewsSortedDesc: ReviewForSentiment[]): string {
  const last = reviewsSortedDesc[0];
  if (!last) {
    return 'Pas d’avis Google relié à ce nom pour l’instant.';
  }
  const when = formatDistanceToNow(new Date(last.created_at), { addSuffix: true, locale: fr });
  return `Dernier avis laissé : ${last.rating}/5 ${when}.`;
}
