'use client';

import { RootSegmentErrorFallback } from '@/components/errors/root-segment-error-fallback';
import { routing } from '@/i18n/routing';

function localeFromPath(): string {
  if (typeof window === 'undefined') return routing.defaultLocale;
  const seg = window.location.pathname.split('/').filter(Boolean)[0];
  return (routing.locales as readonly string[]).includes(seg) ? seg : routing.defaultLocale;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang={localeFromPath()}>
      <body>
        <RootSegmentErrorFallback error={error} reset={reset} variant="critical" />
      </body>
    </html>
  );
}
