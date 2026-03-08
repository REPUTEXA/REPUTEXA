'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'system-ui' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Erreur critique</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>{error.message}</p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.75rem', background: '#2563eb', color: 'white', fontWeight: 500, border: 'none', cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
