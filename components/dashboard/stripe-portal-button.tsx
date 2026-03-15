'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

type StripePortalButtonProps = {
  locale?: string;
  /** 'upgrade' = écran "Mettre à jour l'abonnement", retour dashboard avec confettis. 'add-establishment' = idem pour ajout établissement. */
  flow?: 'upgrade' | 'add-establishment';
  children?: React.ReactNode;
  className?: string;
  onError?: (error: Error) => void;
};

export function StripePortalButton({
  locale = 'fr',
  flow,
  children = 'Gérer mon abonnement et mes factures',
  className = 'inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300',
  onError,
}: StripePortalButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/stripe/portal', window.location.origin);
      url.searchParams.set('locale', locale);
      if (flow) url.searchParams.set('flow', flow);
      const res = await fetch(url.toString(), { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      if (data?.url) window.location.href = data.url;
      else throw new Error('URL non reçue');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
      style={{ backgroundColor: '#2563eb' }}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Redirection...
        </>
      ) : (
        children
      )}
    </button>
  );
}
