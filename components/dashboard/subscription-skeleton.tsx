'use client';

import { memo } from 'react';

/**
 * Skeleton pour la zone qui affiche le statut d'abonnement (plan, quantité, interval).
 * Évite le layout shift pendant le chargement de useSubscription().
 */
export const SubscriptionSkeleton = memo(function SubscriptionSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse" aria-hidden>
      <div className="h-5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
});
