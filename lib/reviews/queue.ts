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

/** Seuil positif : >= 4 étoiles → automatisé ; < 4 → action requise */
export const POSITIVE_THRESHOLD = 4;

export function isPositiveReview(rating: number): boolean {
  return rating >= POSITIVE_THRESHOLD;
}

/** Génère un token sécurisé pour le lien quick-reply */
export function generateQuickReplyToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
