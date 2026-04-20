/**
 * Persistance du "panier" (plan + cycle) pour reprendre une souscription après annulation
 * ou retour sur le site (ex: onglet Stripe fermé).
 */

const KEY = 'reputexa_checkout_intent';
export const INTENT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export type CheckoutIntent = {
  plan: string;
  annual: boolean;
  quantity: number;
  timestamp: number;
};

export function saveCheckoutIntent(plan: string, annual: boolean, quantity: number): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ plan, annual, quantity, timestamp: Date.now() })
      );
    }
  } catch {
    /* ignore */
  }
}

export function getCheckoutIntent(): CheckoutIntent | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CheckoutIntent;
    if (!data?.plan || !data.timestamp || Date.now() - data.timestamp > INTENT_MAX_AGE_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
