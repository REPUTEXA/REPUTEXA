'use client';

import { Component, type ReactNode } from 'react';
import { SuccessPaymentToast } from './success-payment-toast';
import { SubscriptionSuccessEffects } from './subscription-success-effects';
import { UpgradeSuccessToast } from './upgrade-success-toast';

/**
 * Error boundary pour éviter que les effets post-paiement (confettis, toast)
 * fassent planter toute la page si un composant lève une erreur.
 */
class SuccessEffectsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Erreur silencieuse : on ne bloque pas le dashboard
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function SuccessEffectsWrapper() {
  return (
    <SuccessEffectsErrorBoundary>
      <SuccessPaymentToast />
      <SubscriptionSuccessEffects />
      <UpgradeSuccessToast />
    </SuccessEffectsErrorBoundary>
  );
}
