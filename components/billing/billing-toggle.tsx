'use client';

import { useId, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useBillingCycleOptional } from '@/lib/billing-cycle-context';
import type { BillingInterval } from '@/lib/use-subscription';

type Props = {
  /** Si fourni, le toggle est contrôlé (value + onChange). Sinon utilise le contexte ou état local. */
  value?: BillingInterval;
  onChange?: (cycle: BillingInterval) => void;
  /** Badge à côté de "Annuel" : "-20% d'économie" ou "2 mois offerts" */
  annualBadge?: string;
  /** Labels (optionnel) */
  monthlyLabel?: string;
  annualLabel?: string;
  className?: string;
};

const defaultAnnualBadge = '-20%';

/**
 * Toggle Mensuel / Annuel style Apple/Radix avec animation de glissement.
 * Utilise le contexte BillingCycle si value/onChange ne sont pas fournis.
 */
export function BillingToggle({
  value,
  onChange,
  annualBadge = defaultAnnualBadge,
  monthlyLabel = 'Mensuel',
  annualLabel = 'Annuel',
  className = '',
}: Props) {
  const id = useId();
  const context = useBillingCycleOptional();
  const [localCycle, setLocalCycle] = useState<BillingInterval>('month');
  const isControlled = value !== undefined && onChange !== undefined;
  const isAnnual = isControlled
    ? value === 'year'
    : context
      ? context.isAnnual
      : localCycle === 'year';
  const setAnnual = useCallback(
    (annual: boolean) => {
      const next: BillingInterval = annual ? 'year' : 'month';
      if (isControlled) onChange(next);
      else if (context) context.setBillingCycle(next);
      else setLocalCycle(next);
    },
    [isControlled, onChange, context]
  );

  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      role="group"
      aria-label="Cycle de facturation"
    >
      <span
        className={`text-sm font-medium transition-colors duration-200 ${
          !isAnnual ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {monthlyLabel}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isAnnual}
        aria-label={isAnnual ? 'Facturation annuelle' : 'Facturation mensuelle'}
        onClick={() => setAnnual(!isAnnual)}
        className="relative w-14 h-8 rounded-full bg-slate-200 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors duration-200"
      >
        <motion.span
          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white dark:bg-slate-100 shadow-md"
          animate={{ x: isAnnual ? 24 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      </button>
      <span
        className={`text-sm font-medium transition-colors duration-200 ${
          isAnnual ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {annualLabel}
      </span>
      <span className="ml-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold whitespace-nowrap">
        {annualBadge}
      </span>
    </div>
  );
}
