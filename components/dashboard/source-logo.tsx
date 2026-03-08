'use client';

type Source = 'google' | 'tripadvisor' | 'trustpilot';

type Props = {
  source: string;
  className?: string;
};

export function SourceLogo({ source, className = 'w-5 h-5' }: Props) {
  const s = source.toLowerCase() as Source;

  if (s === 'google') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87 2.6 3.3 4.53 6.16 4.53z" />
      </svg>
    );
  }

  if (s === 'tripadvisor') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#00AF87" d="M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.997 5.997 0 0 0 4.04 10.43 5.976 5.976 0 0 0 4.075-1.6L12 19.705l1.922-2.09a5.976 5.976 0 0 0 4.075 1.6 5.997 5.997 0 0 0 4.04-10.43L24 6.648h-4.35a13.573 13.573 0 0 0-7.644-2.353zM12 6.255c1.531 0 3.063.303 4.504.91a4.003 4.003 0 0 1-2.394 7.545 3.984 3.984 0 0 1-2.11-.635L12 12.5l-1 1.575a3.984 3.984 0 0 1-2.11.635 4.003 4.003 0 0 1-2.394-7.545c1.441-.607 2.973-.91 4.504-.91z" />
      </svg>
    );
  }

  if (s === 'trustpilot') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#00B67A" d="M12 0l2.969 9.062 8.031.609-5.969 4.656 2.125 7.812L12 18.391l-4.156 2.749 2.125-7.812L2 9.67l8.031-.61z" />
      </svg>
    );
  }

  return (
    <span className="text-xs font-medium text-slate-500">{source}</span>
  );
}
