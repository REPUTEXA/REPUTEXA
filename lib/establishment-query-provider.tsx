'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/** Données dashboard : réutiliser le cache pour des transitions instantanées entre onglets. */
const STALE_TIME = 60 * 1000; // 60s
const CACHE_TIME = 10 * 60 * 1000; // 10min

export const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: CACHE_TIME,
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 2000),
    },
  },
});

export function EstablishmentQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(() => defaultQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Clés de requête pour invalidation globale au changement d'établissement */
export const ESTABLISHMENT_QUERY_KEYS = [
  'reviews',
  'establishments',
  'profile',
  'weekly-insight',
  'statistics',
  'dashboard',
  'alerts',
  'growth-stats',
] as const;
