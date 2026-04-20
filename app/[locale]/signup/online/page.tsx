'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';

/**
 * /signup/online — Redirige vers la page signup avec type=digital pré-sélectionné.
 * Conserve les paramètres mode, plan, annual s'ils sont présents.
 */
export default function SignupOnlinePage() {
  const locale = useLocale();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('mode', searchParams?.get('mode') ?? 'checkout');
    params.set('type', 'digital');
    if (searchParams?.get('plan')) params.set('plan', searchParams.get('plan')!);
    if (searchParams?.get('annual')) params.set('annual', searchParams.get('annual')!);
    window.location.replace(`/${locale}/signup?${params.toString()}`);
  }, [locale, searchParams]);

  return null;
}
