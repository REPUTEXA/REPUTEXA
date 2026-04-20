'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';

/** Locale-aware country name (ISO 3166-1 alpha-2) for Growth War Room. */
export function useGrowthCountryLabel() {
  const locale = useLocale();
  return useCallback(
    (iso3166Alpha2: string | null | undefined) => {
      const code = (iso3166Alpha2 ?? '').trim().toUpperCase();
      if (!code) return '—';
      try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
      } catch {
        return code;
      }
    },
    [locale],
  );
}
