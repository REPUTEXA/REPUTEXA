'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BRAND_R_LOGO_PNG } from '@/lib/brand/brand-logo-path';

/** Délai avant d’afficher le plein écran (évite le flash si le chargement est court). */
export const DEFAULT_BRAND_LOADER_DELAY_MS = 1000;

type Phase = 'waiting' | 'visible';

type BrandPageLoaderProps = {
  /** Attente en ms avant d’afficher le R (0 = immédiat, ex. après `BrandLoadingOverlay`). */
  delayMs?: number;
};

export function BrandPageLoader({ delayMs = DEFAULT_BRAND_LOADER_DELAY_MS }: BrandPageLoaderProps) {
  const t = useTranslations('Common.brandLoader');
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(() => (delayMs <= 0 ? 'visible' : 'waiting'));

  useEffect(() => {
    if (reduce) return;
    if (delayMs <= 0) return;
    if (phase !== 'waiting') return;
    const id = window.setTimeout(() => setPhase('visible'), delayMs);
    return () => clearTimeout(id);
  }, [reduce, delayMs, phase]);

  useEffect(() => {
    if (reduce) return;
    if (phase !== 'visible') return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [phase, reduce]);

  if (reduce) return null;
  if (phase === 'waiting') return null;

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex flex-col bg-[#050505]"
      role="status"
      aria-live="polite"
      aria-busy
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      <span className="sr-only">{t('ariaStatus')}</span>
      <div className="h-[2px] w-full overflow-hidden bg-white/5" aria-hidden>
        <motion.div
          className="h-full w-1/3 bg-gradient-to-r from-[#2563eb] via-[#38bdf8] to-[#2563eb]"
          initial={{ x: '-100%' }}
          animate={{ x: '400%' }}
          transition={{
            duration: 1.35,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          animate={{
            scale: [1, 1.04, 1],
            opacity: [1, 0.92, 1],
          }}
          transition={{
            duration: 2.2,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        >
          <Image
            src={BRAND_R_LOGO_PNG}
            alt=""
            width={112}
            height={112}
            priority
            className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-[0_0_40px_rgba(37,99,235,0.35)]"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * Plein écran R après 1 s si `active` reste vrai (chargements pilotés par état client).
 */
export function BrandLoadingOverlay({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active || reduce) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(true), DEFAULT_BRAND_LOADER_DELAY_MS);
    return () => clearTimeout(id);
  }, [active, reduce]);

  if (!active || reduce) return null;
  if (!show) return null;
  return <BrandPageLoader delayMs={0} />;
}
