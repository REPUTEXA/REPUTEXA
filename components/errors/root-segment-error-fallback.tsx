'use client';

import { useEffect, useState } from 'react';
import { createTranslator } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import { routing } from '@/i18n/routing';

export type RootSegmentErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  variant?: 'default' | 'critical';
};

function pickLocaleFromPath(): string {
  if (typeof window === 'undefined') return routing.defaultLocale;
  const seg = window.location.pathname.split('/').filter(Boolean)[0];
  return (routing.locales as readonly string[]).includes(seg) ? seg : routing.defaultLocale;
}

/**
 * Imports explicites par locale : Turbopack ne résout pas `import(\`@/messages/${locale}.json\`)`.
 */
async function loadMessagesForLocale(locale: string): Promise<AbstractIntlMessages> {
  const loc = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  switch (loc) {
    case 'fr':
      return (await import('@/messages/fr.json')).default as unknown as AbstractIntlMessages;
    case 'en':
      return (await import('@/messages/en.json')).default as unknown as AbstractIntlMessages;
    case 'es':
      return (await import('@/messages/es.json')).default as unknown as AbstractIntlMessages;
    case 'de':
      return (await import('@/messages/de.json')).default as unknown as AbstractIntlMessages;
    case 'it':
      return (await import('@/messages/it.json')).default as unknown as AbstractIntlMessages;
    case 'pt':
      return (await import('@/messages/pt.json')).default as unknown as AbstractIntlMessages;
    case 'ja':
      return (await import('@/messages/ja.json')).default as unknown as AbstractIntlMessages;
    case 'zh':
      return (await import('@/messages/zh.json')).default as unknown as AbstractIntlMessages;
    default:
      return (await import('@/messages/fr.json')).default as unknown as AbstractIntlMessages;
  }
}

export function RootSegmentErrorFallback({
  error,
  reset,
  variant = 'default',
}: RootSegmentErrorFallbackProps) {
  const [ui, setUi] = useState<{
    t: (key: string) => string;
    locale: string;
  } | null>(null);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const locale = pickLocaleFromPath();
    void loadMessagesForLocale(locale).then((messages) => {
      const t = createTranslator({ locale, messages, namespace: 'Common.errorFallback' });
      setUi({
        locale,
        t: (key: string) => String(t(key as 'title' | 'criticalTitle' | 'retry')),
      });
    });
  }, []);

  const titleKey = variant === 'critical' ? 'criticalTitle' : 'title';

  if (!ui) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50 px-4"
        aria-busy="true"
      />
    );
  }

  if (variant === 'critical') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily: 'system-ui',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {ui.t(titleKey)}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>{error.message}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            background: '#2563eb',
            color: 'white',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {ui.t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h2 className="font-display text-xl font-bold text-slate-900 mb-2">{ui.t(titleKey)}</h2>
      <p className="text-slate-500 text-sm mb-4 text-center max-w-md">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:brightness-110 transition-colors"
      >
        {ui.t('retry')}
      </button>
    </div>
  );
}

export default function RootSegmentErrorDefault(props: Omit<RootSegmentErrorFallbackProps, 'variant'>) {
  return <RootSegmentErrorFallback {...props} />;
}
