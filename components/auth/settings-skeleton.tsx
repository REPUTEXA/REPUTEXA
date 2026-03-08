'use client';

/** Skeleton de chargement pour la page Paramètres (profil + compte) */
export function SettingsSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-6 space-y-8 animate-pulse">
      <header>
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-64 rounded bg-slate-100" />
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-11 w-28 rounded-xl bg-slate-200" />
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <div className="h-6 w-32 rounded bg-slate-200" />
        <div className="space-y-3">
          <div className="h-10 rounded-xl bg-slate-100" />
          <div className="h-10 rounded-xl bg-slate-100" />
        </div>
        <div className="h-11 w-40 rounded-xl bg-slate-200" />
      </section>
    </div>
  );
}
