'use client';

import { useState, useEffect } from 'react';

/**
 * Retourne true une fois le composant monté côté client.
 * Évite les erreurs d'hydratation (window, useSearchParams, etc.).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
