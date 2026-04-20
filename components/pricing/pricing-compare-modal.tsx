'use client';

import { Fragment, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { PRICING_COMPARE_MATRIX } from '@/config/pricing-compare-matrix';
import { PLAN_ORDER } from '@/config/pricing-plan-display';
import type { PlanSlug } from '@/config/pricing';

/** Framer Motion transition config — module const avoids i18next/no-literal-string on `type: 'spring'`. */
const COMPARE_MODAL_PANEL_SPRING = { type: 'spring' as const, damping: 26, stiffness: 320 };

type Props = {
  open: boolean;
  onClose: () => void;
};

function MatrixCell({ included }: { included: boolean }) {
  return (
    <div className="flex justify-center items-center py-3 min-h-[3.25rem]">
      {included ? (
        <Check className="w-5 h-5 text-emerald-500" strokeWidth={2.5} aria-hidden />
      ) : (
        <X className="w-5 h-5 text-red-500" strokeWidth={2.5} aria-hidden />
      )}
    </div>
  );
}

export function PricingCompareModal({ open, onClose }: Props) {
  const t                                 = useTranslations('PricingPage');
  const panelRef                          = useRef<HTMLDivElement>(null);
  const previouslyFocused                 = useRef<HTMLElement | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button')?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onKeyDown]);

  if (typeof document === 'undefined') return null;

  const planTitles: Record<PlanSlug, string> = {
    vision: t('visionTitle'),
    pulse: t('pulseTitle'),
    zenith: t('zenithTitle'),
  };

  const content = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="presentation"
        >
          <button
            type="button"
            aria-label={t('compareModalClose')}
            className="absolute inset-0 bg-slate-950/45 dark:bg-black/55 backdrop-blur-xl cursor-default supports-[backdrop-filter]:backdrop-saturate-150"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-compare-modal-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={COMPARE_MODAL_PANEL_SPRING}
            className="relative w-full max-w-5xl max-h-[min(90vh,960px)] flex flex-col rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/25 dark:shadow-black/50 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-5 sm:px-7 pt-5 sm:pt-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="pricing-compare-modal-title" className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50">
                    {t('compareModalTitle')}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {t('compareModalHint')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('compareModalClose')}
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <table className="w-full min-w-[720px] text-left text-[13px] sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80">
                      <th
                        scope="col"
                        className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800/95 px-3 sm:px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 min-w-[240px] sm:min-w-[280px]"
                      >
                        {t('compareMatrixColFeature')}
                      </th>
                      {PLAN_ORDER.map((slug) => (
                        <th
                          key={slug}
                          scope="col"
                          className="px-2 sm:px-3 py-3 text-center font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 w-[22%]"
                        >
                          {planTitles[slug]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PRICING_COMPARE_MATRIX.map((section) => (
                      <Fragment key={section.titleKey}>
                        <tr className="bg-[#2563eb]/[0.06] dark:bg-[#2563eb]/10">
                          <td
                            colSpan={4}
                            className="px-3 sm:px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb] dark:text-blue-300 border-b border-slate-200/80 dark:border-slate-700"
                          >
                            {t(section.titleKey)}
                          </td>
                        </tr>
                        {section.rows.map((row) => (
                          <tr
                            key={row.labelKey}
                            className="group border-b border-slate-100 dark:border-slate-800/90 last:border-b-0 bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/35 transition-colors"
                          >
                            <th
                              scope="row"
                              className="sticky left-0 z-10 px-3 sm:px-4 py-3 font-normal text-slate-700 dark:text-slate-200 text-left align-top bg-white dark:bg-slate-900 group-hover:bg-slate-50/90 dark:group-hover:bg-slate-800/35 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.4)] transition-colors"
                            >
                              <span className="block font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                                {t(row.labelKey)}
                              </span>
                              {row.detailKey ? (
                                <span className="block mt-1.5 text-[12px] sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 leading-relaxed">
                                  {t(row.detailKey)}
                                </span>
                              ) : null}
                            </th>
                            <td className="text-center border-l border-slate-100 dark:border-slate-800">
                              <MatrixCell included={row.vision} />
                            </td>
                            <td className="text-center border-l border-slate-100 dark:border-slate-800">
                              <MatrixCell included={row.pulse} />
                            </td>
                            <td className="text-center border-l border-slate-100 dark:border-slate-800">
                              <MatrixCell included={row.zenith} />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-1">
                {t('compareMatrixFootnote')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
