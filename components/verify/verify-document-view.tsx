'use client';

type Labels = {
  pageTitle: string;
  validTitle: string;
  validBody: string;
  issuerLabel: string;
  issuedLabel: string;
  fingerprintLabel: string;
  invalidTitle: string;
  invalidBody: string;
  laserAria: string;
};

type Props = {
  valid: boolean;
  labels: Labels;
  issuerName?: string;
  issuedDisplay?: string;
  fingerprint?: string;
};

export function VerifyDocumentView({ valid, labels, issuerName, issuedDisplay, fingerprint }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="verify-laser-line" role="presentation" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.07),_transparent_55%)]"
        aria-hidden
      />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-amber-500/90">
          {labels.pageTitle}
        </h1>

        {valid ? (
          <div className="mt-10 rounded-2xl border border-emerald-500/35 bg-emerald-950/25 px-6 py-8 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]">
            <p className="text-center text-lg font-semibold tracking-tight text-emerald-100">{labels.validTitle}</p>
            <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">{labels.validBody}</p>
            <dl className="mt-8 space-y-3 border-t border-zinc-800/80 pt-6 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">{labels.issuerLabel}</dt>
                <dd className="text-right font-medium text-zinc-200">{issuerName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">{labels.issuedLabel}</dt>
                <dd className="text-right font-medium text-zinc-200">{issuedDisplay}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">{labels.fingerprintLabel}</dt>
                <dd className="text-right font-mono text-xs text-amber-200/90">{fingerprint}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-950/20 px-6 py-8 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.12)]">
            <p className="text-center text-lg font-semibold tracking-tight text-red-100">{labels.invalidTitle}</p>
            <p className="mt-4 text-center text-sm leading-relaxed text-zinc-400">{labels.invalidBody}</p>
          </div>
        )}
      </main>

      <span className="sr-only">{labels.laserAria}</span>
    </div>
  );
}
