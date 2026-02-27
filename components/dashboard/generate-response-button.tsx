'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Loader2 } from 'lucide-react';

type Props = {
  reviewId: string;
  className?: string;
  label?: string;
};

export function GenerateResponseButton({
  reviewId,
  className = '',
  label = 'Générer une réponse IA',
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/generate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Erreur');
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <Zap className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  );
}
