'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useActiveLocationOptional } from '@/lib/active-location-context';

/**
 * Quand l'URL contient ?location=xxx ou ?eid=xxx, synchronise l'établissement actif
 * du dashboard avec ce paramètre (cookie + contexte). Permet deep-link et partage d'URL.
 */
export function SyncLocationFromUrl() {
  const searchParams = useSearchParams();
  const activeLocation = useActiveLocationOptional();
  const appliedRef = useRef(false);

  useEffect(() => {
    const loc = searchParams?.get('location') ?? searchParams?.get('eid');
    if (!loc || !activeLocation?.setActiveLocationId || appliedRef.current) return;

    const validIds = activeLocation.locations.map((l) => l.id);
    if (validIds.includes(loc)) {
      activeLocation.setActiveLocationId(loc);
      appliedRef.current = true;
    }
  }, [searchParams, activeLocation]);

  return null;
}
