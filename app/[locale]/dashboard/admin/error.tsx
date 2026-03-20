'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="min-h-full bg-zinc-950 flex flex-col items-center justify-center p-8">
      <h2 className="text-lg font-bold text-white mb-2">Erreur du panel admin</h2>
      <p className="text-zinc-400 text-sm mb-6 text-center max-w-md">{error.message}</p>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
