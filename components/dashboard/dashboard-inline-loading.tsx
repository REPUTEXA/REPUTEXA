'use client';

import { Loader2 } from 'lucide-react';

/**
 * Chargement dans le cadre du dashboard : pas de plein écran logo marque.
 */
export function DashboardInlineLoading() {
  return (
    <div
      className="flex min-h-[40vh] w-full items-center justify-center px-6"
      role="status"
      aria-busy
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
    </div>
  );
}
