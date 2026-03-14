'use client';

/**
 * Skeleton affiché pendant la résolution des searchParams (useSearchParams).
 * Évite les erreurs d'hydratation et le flash de contenu vide.
 */
export function DashboardLoadingFallback() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#030303]">
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-60 flex-col border-r border-transparent dark:border-zinc-800/50 bg-[#0B1221] dark:bg-black/40 lg:flex" aria-hidden />
      <div className="flex flex-1 flex-col min-w-0 lg:ml-60">
        <header className="sticky top-0 z-20 h-14 sm:h-16 border-b border-slate-200/80 dark:border-zinc-800/50 bg-white/70 dark:bg-[#09090b]/80 backdrop-blur-md flex items-center px-4 sm:px-6">
          <div className="h-9 w-full max-w-md rounded-2xl bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse" />
        </header>
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="h-8 w-48 rounded bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse" />
            <div className="h-10 w-64 rounded bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
