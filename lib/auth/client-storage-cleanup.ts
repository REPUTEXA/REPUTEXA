/**
 * Purge des caches navigateur liés à un ancien compte (checkout, aides UI, tokens Supabase).
 * Ne touche pas à sessionStorage signup (mots de passe en attente OTP) — géré à part.
 *
 * À appeler :
 *   - Avant l'inscription d'un nouveau compte (évite les résidus d'une session précédente)
 *   - Après un logout côté client (en complément de supabase.auth.signOut())
 */

import { clearCheckoutIntent } from '@/lib/checkout-intent';

/** Préfixes localStorage à nettoyer lors d'un changement de compte. */
const STALE_PREFIXES = [
  'zapier_intro_seen_',
  'sb-',           // tokens Supabase (ex: sb-<project-ref>-auth-token)
  'supabase.auth', // legacy key (ancienne version @supabase/auth-helpers)
];

export function purgeClientCachesForNewAccount(): void {
  if (typeof window === 'undefined') return;

  clearCheckoutIntent();

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && STALE_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* Accès localStorage bloqué (mode privé strict) — silencieux. */
  }

  try {
    // Vider aussi sessionStorage pour les flows d'inscription multi-étapes abandonnés
    const ssKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('sb-')) ssKeys.push(k);
    }
    for (const k of ssKeys) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
