export type BrandSealVariant = 'light' | 'dark';

export type BrandSealProps = {
  variant: BrandSealVariant;
  legalName: string;
  registrationLabel: string;
  registrationNumber: string;
  headquartersAddress: string;
  logoSrc: string;
  /** Optionnel : ancrage export PNG / tests */
  id?: string;
  className?: string;
};

/**
 * Tampon de marque « institution » : logo, nom, ligne légale (libellé + n°), siège.
 * Variantes clair / sombre pour fonds papier ou interface admin.
 */
export function BrandSeal({
  variant,
  legalName,
  registrationLabel,
  registrationNumber,
  headquartersAddress,
  logoSrc,
  id,
  className = '',
}: BrandSealProps) {
  const dark = variant === 'dark';
  const addressLines = headquartersAddress.split(/\r?\n/).filter(Boolean);

  return (
    <div
      id={id}
      className={[
        'inline-flex max-w-[28rem] select-none items-stretch gap-4 rounded-sm border px-5 py-4',
        dark
          ? 'border-amber-500/30 bg-zinc-950/90 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.07),0_1px_2px_rgba(0,0,0,0.45)]'
          : 'border-zinc-400/70 bg-white text-zinc-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)]',
        className,
      ].join(' ')}
    >
      <div className="flex shrink-0 flex-col items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- raster PNG export (html2canvas) needs a plain <img> */}
        <img src={logoSrc} alt="" width={52} height={52} className="h-[52px] w-[52px] object-contain opacity-95" />
      </div>

      <div
        className={['hidden w-px shrink-0 sm:block', dark ? 'bg-amber-500/25' : 'bg-zinc-300/90'].join(' ')}
        aria-hidden
      />

      <div className="min-w-0 flex-1 text-left">
        <p
          className={[
            'font-semibold uppercase tracking-[0.22em] leading-tight',
            dark ? 'text-zinc-100' : 'text-zinc-950',
          ].join(' ')}
          style={{ fontSize: '0.8125rem' }}
        >
          {legalName}
        </p>
        <p
          className={[
            'mt-3 text-[10px] leading-snug tracking-wide',
            dark ? 'text-zinc-400' : 'text-zinc-600',
          ].join(' ')}
        >
          <span className={dark ? 'text-zinc-500' : 'text-zinc-500'}>{registrationLabel}</span>
          <span className="mx-1.5 inline-block h-px w-1.5 translate-y-[-0.15em] rounded-full bg-current opacity-40" />
          <span className="font-mono tabular-nums tracking-tight">{registrationNumber}</span>
        </p>
        <div
          className={[
            'mt-2 space-y-0.5 text-[9px] leading-relaxed tracking-[0.02em]',
            dark ? 'text-zinc-500' : 'text-zinc-500',
          ].join(' ')}
        >
          {addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
