/**
 * Client Stripe avec retries intelligents (timeout / erreurs réseau).
 * Règle : Stripe est la source de vérité ; les appels doivent être résilients.
 */

import Stripe from 'stripe';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 500;
const TIMEOUT_MS = 25_000;

function isRetryable(err: unknown): boolean {
  if (err instanceof Stripe.errors.StripeError) {
    const code = (err as { code?: string }).code;
    if (code === 'StripeConnectionError' || code === 'StripeAPIError') return true;
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode !== undefined && (statusCode === 408 || statusCode === 429 || statusCode >= 500)) return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return (
    /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network/i.test(message) ||
    message.includes('fetch failed')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retourne une instance Stripe configurée (clé secrète).
 * Pour les appels critiques, préférer stripeWithRetry.
 */
export function getStripe(secretKey?: string): Stripe {
  const key = secretKey ?? process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, {
    typescript: true,
    timeout: TIMEOUT_MS,
  });
}

/**
 * Exécute une opération Stripe avec retries en cas d'erreur réseau / timeout.
 */
export async function stripeWithRetry<T>(
  operation: (stripe: Stripe) => Promise<T>,
  secretKey?: string
): Promise<T> {
  const stripe = getStripe(secretKey);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation(stripe);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        const backoff = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await delay(backoff);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
