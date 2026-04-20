'use client';

/**
 * Pastille « ? » : survol = infobulle native (title) pour expliquer une action ou une section admin.
 */
export function AdminHelpPastille({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 ml-1 rounded-full bg-sky-500/20 border border-sky-400/35 text-[9px] font-bold text-sky-300 cursor-help align-middle shrink-0 leading-none"
      title={text}
      role="img"
      aria-label={text}
    >
      ?
    </span>
  );
}

/** Pastille couleur (gravité / statut) avec légende au survol. */
export function AdminStatusDot({
  tone,
  title: label,
}: {
  tone: 'critical' | 'warn' | 'ok' | 'neutral';
  title: string;
}) {
  const cls =
    tone === 'critical'
      ? 'bg-red-500'
      : tone === 'warn'
        ? 'bg-amber-400'
        : tone === 'ok'
          ? 'bg-emerald-500'
          : 'bg-zinc-500';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`}
      title={label}
      aria-label={label}
    />
  );
}
