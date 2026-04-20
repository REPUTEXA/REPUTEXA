'use client';

import dynamic from 'next/dynamic';

const Turnstile = dynamic(
  () => import('react-turnstile').then((mod) => mod.Turnstile),
  { ssr: false }
);

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type Props = {
  onVerify: (token: string) => void;
  onExpire?: (token?: string) => void;
  action?: string;
};

/**
 * Turnstile invisible ou minimaliste (managed) pour ne pas casser le design Zenith.
 * Si NEXT_PUBLIC_TURNSTILE_SITE_KEY manque, le composant ne s'affiche pas et onVerify n'est jamais appelé.
 */
export function AuthTurnstile({ onVerify, onExpire, action }: Props) {
  if (!SITE_KEY) {
    return null;
  }

  return (
    <div className="min-h-[1px] overflow-hidden" aria-hidden>
      <Turnstile
        sitekey={SITE_KEY}
        theme="light"
        size="invisible"
        action={action ?? 'auth'}
        onVerify={onVerify}
        onExpire={onExpire ? () => onExpire() : undefined}
      />
    </div>
  );
}
