'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

type Props = { children: ReactNode };

type State = { error: Error | null };

function BananoClientsErrorFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useTranslations('Dashboard');
  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/25 p-6 space-y-3 max-w-2xl">
      <div className="flex items-center gap-2 text-red-800 dark:text-red-200 font-semibold">
        <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
        {t('whatsappReviewMeta.clientsBoundaryTitle')}
      </div>
      <p className="text-sm text-red-900/90 dark:text-red-100/90">{t('whatsappReviewMeta.clientsBoundaryDescription')}</p>
      <pre className="text-xs font-mono whitespace-pre-wrap break-words text-red-950/80 dark:text-red-100/80 bg-white/60 dark:bg-black/20 rounded-lg p-3 border border-red-100 dark:border-red-900/40 max-h-40 overflow-y-auto">
        {message}
      </pre>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm font-semibold text-[#2563eb] hover:underline"
      >
        {t('whatsappReviewError.retry')}
      </button>
    </div>
  );
}

/**
 * Évite l’écran blanc si un sous-arbre client jette (ex. dépendance incompatible SSR).
 */
export class BananoClientsErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[BananoClientsErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <BananoClientsErrorFallback
          message={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
