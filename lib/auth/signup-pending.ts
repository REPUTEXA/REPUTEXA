/**
 * Gestion sécurisée du sessionStorage pour le flux OTP signup.
 * Nettoyage immédiat après usage pour éviter toute fuite de credentials.
 */

const KEY = 'reputexa_signup_pending';

export type SignupPending = { email: string; password: string };

export function storeSignupPending(data: SignupPending): void {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(KEY, JSON.stringify(data));
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumeSignupPending(email?: string): SignupPending | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const data = JSON.parse(raw) as SignupPending;
    if (typeof data?.email !== 'string' || typeof data?.password !== 'string') return null;
    if (email && data.email.toLowerCase() !== email.toLowerCase()) return null;
    return data;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function hasSignupPending(): boolean {
  try {
    return typeof window !== 'undefined' && !!sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}
