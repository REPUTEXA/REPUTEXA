'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const STALE_TIME = 30 * 1000; // 30s
const CACHE_TIME = 5 * 60 * 1000; // 5min

export const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: CACHE_TIME,
      refetchOnWindowFocus: false,
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
