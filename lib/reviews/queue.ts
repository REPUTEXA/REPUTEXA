import crypto from 'crypto';

export type ReviewStatus = 'pending' | 'generating' | 'scheduled' | 'published';

/** Délai aléatoire entre 30 min et 4 heures (en ms) */
export function calculateDelayMs(): number {
  const minMinutes = 30;
  const maxMinutes = 4 * 60; // 4 heures
  const minutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
  return minutes * 60 * 1000;
}

/** Date/heure de publication prévue (30 min à 4h après maintenant) */
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
