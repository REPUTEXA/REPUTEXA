import crypto from 'crypto';

export type ReviewStatus = 'pending' | 'generating' | 'scheduled' | 'published' | 'pending_publication';

/** Délai human-like : entre 120 min (2h) et 420 min (7h) — simule temps de réflexion du patron */
export function calculateDelayMs(): number {
  const minMinutes = 120;  // 2h
  const maxMinutes = 420;  // 7h
  const minutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
  return minutes * 60 * 1000;
}

/** Date/heure de publication prévue (2h à 7h après maintenant) */
export function calculateScheduledAt(): Date {
  return new Date(Date.now() + calculateDelayMs());
}

/** Avis 4–5★ (non toxiques) : réponse IA + file de publication automatique. 1–3★ : validation (Vision) ou WhatsApp (Pulse+). */
export const AUTO_QUEUE_MIN_RATING = 4;

/** @deprecated alias — ancien nom ; le seuil auto est désormais 4★. */
export const POSITIVE_THRESHOLD = AUTO_QUEUE_MIN_RATING;

export function isAutoQueueReview(rating: number): boolean {
  return rating >= AUTO_QUEUE_MIN_RATING;
}

/** @deprecated utiliser isAutoQueueReview */
export function isPositiveReview(rating: number): boolean {
  return isAutoQueueReview(rating);
}

/**
 * Si d’autres avis sont déjà planifiés après celui-ci, repousse ce créneau
 * pour éviter de publier 5 réponses exactement au même instant (effet humain).
 */
export function resolveStaggeredScheduledAt(lastScheduledAtIso: string | null | undefined): Date {
  const base = calculateScheduledAt();
  if (!lastScheduledAtIso) return base;
  const lastMs = new Date(lastScheduledAtIso).getTime();
  if (Number.isNaN(lastMs)) return base;
  const minGapMs = (5 + Math.floor(Math.random() * 11)) * 60 * 1000; // +5 à +15 min après le dernier
  const staggeredMs = lastMs + minGapMs;
  return new Date(Math.max(base.getTime(), staggeredMs));
}

/** Génère un token sécurisé pour le lien quick-reply */
export function generateQuickReplyToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
