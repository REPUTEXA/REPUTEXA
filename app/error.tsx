'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h2 className="font-display text-xl font-bold text-slate-900 mb-2">Une erreur est survenue</h2>
      <p className="text-slate-500 text-sm mb-4 text-center max-w-md">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:brightness-110 transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
