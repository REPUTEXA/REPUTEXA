'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Rend les overlays admin au niveau de document.body pour sortir du &lt;main&gt;
 * (sinon ils restent sous le header sticky z-20 du dashboard).
 * z-index au-dessus du header / sidebar du dashboard, et sous LegalConsentModal (9999).
 */
export function AdminModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
