'use client';

/**
 * Wrapper appliquant Spotlight + Film grain pour cohérence visuelle.
 * À utiliser sur les pages publiques (contact, blog, api, guides, about, etc.)
 */
export function PageVisualWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-spotlight page-film-grain relative min-h-screen">
      <div className="relative z-10">{children}</div>
    </div>
  );
}
