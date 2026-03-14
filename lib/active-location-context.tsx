'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ESTABLISHMENT_QUERY_KEYS } from '@/lib/establishment-query-provider';

const ACTIVE_LOCATION_COOKIE = 'reputexa_active_location';

export type LocationItem = {
  id: string;
  name: string;
  isPrincipal?: boolean;
  googleLocationId?: string | null;
};

type ActiveLocationContextValue = {
  activeLocationId: string;
  setActiveLocationId: (id: string) => void;
  locations: LocationItem[];
  isLoading: boolean;
  refreshLocations: () => void;
};

const ActiveLocationContext = createContext<ActiveLocationContextValue | null>(
  null
);

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

export function useActiveLocation() {
  const ctx = useContext(ActiveLocationContext);
  if (!ctx) {
    throw new Error('useActiveLocation must be used within ActiveLocationProvider');
  }
  return ctx;
}

export function useActiveLocationOptional() {
  return useContext(ActiveLocationContext);
}

type Props = {
  children: React.ReactNode;
  establishmentName: string;
  selectedPlanSlug: 'vision' | 'pulse' | 'zenith' | 'free';
};

export function ActiveLocationProvider({
  children,
  establishmentName,
  selectedPlanSlug,
}: Props) {
  void selectedPlanSlug; // Réservé pour usage futur
  const queryClient = useQueryClient();
  const [locations, setLocations] = useState<LocationItem[]>([
    { id: 'profile', name: establishmentName || 'Mon établissement', isPrincipal: true },
  ]);
  const [activeLocationId, setActiveLocationIdState] = useState<string>('profile');
  const [isLoading, setIsLoading] = useState(true);

  const refreshLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/establishments');
      if (!res.ok) return;
      const data = await res.json();
      const raw = data.establishments ?? [];
      const seen = new Set<string>();
      const list: LocationItem[] = raw
        .filter((e: { id: string }) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        })
        .map((e: { id: string; name?: string; isPrincipal?: boolean }) => ({
          id: e.id,
          name: e.name || 'Sans nom',
          isPrincipal: e.isPrincipal ?? e.id === 'profile',
        }));
      if (list.length === 0) {
        list.push({
          id: 'profile',
          name: establishmentName || 'Mon établissement',
          isPrincipal: true,
        });
      }
      setLocations(list);
      const saved = getCookie(ACTIVE_LOCATION_COOKIE);
      const validIds = list.map((l) => l.id);
      if (saved && validIds.includes(saved)) {
        setActiveLocationIdState(saved);
      } else {
        setActiveLocationIdState('profile');
      }
    } catch {
      setLocations([
        { id: 'profile', name: establishmentName || 'Mon établissement', isPrincipal: true },
      ]);
      setActiveLocationIdState('profile');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentName]);

  useEffect(() => {
    refreshLocations();
  }, [refreshLocations]);

  useEffect(() => {
    const onEstablishmentsUpdated = () => refreshLocations();
    window.addEventListener('establishments-updated', onEstablishmentsUpdated);
    return () => window.removeEventListener('establishments-updated', onEstablishmentsUpdated);
  }, [refreshLocations]);

  const setActiveLocationId = useCallback(
    (id: string) => {
      setActiveLocationIdState(id);
      setCookie(ACTIVE_LOCATION_COOKIE, id);
      window.dispatchEvent(new CustomEvent('active-location-changed', { detail: { locationId: id } }));
      ESTABLISHMENT_QUERY_KEYS.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
    [queryClient]
  );

  useEffect(() => {
    const saved = getCookie(ACTIVE_LOCATION_COOKIE);
    if (saved && locations.some((l) => l.id === saved)) {
      setActiveLocationIdState(saved);
    }
  }, [locations]);

  const value = useMemo(
    () => ({
      activeLocationId,
      setActiveLocationId,
      locations,
      isLoading,
      refreshLocations,
    }),
    [activeLocationId, setActiveLocationId, locations, isLoading, refreshLocations]
  );

  return (
    <ActiveLocationContext.Provider value={value}>
      {children}
    </ActiveLocationContext.Provider>
  );
}
