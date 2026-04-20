'use client';

import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Logo } from '@/components/logo';
import { motion } from 'framer-motion';
import { getCheckoutIntent } from '@/lib/checkout-intent';

const PLAN_TYPES = ['vision', 'pulse', 'zenith', 'starter', 'manager', 'dominator'] as const;
type PlanType = (typeof PLAN_TYPES)[number];

/** Valeur d’easing Framer Motion (API), pas du texte affiché. */
const CHECKOUT_MOTION_EASE = 'easeInOut' as const;

const PLAN_TO_STRIPE: Record<string, 'starter' | 'manager' | 'dominator'> = {
  vision: 'starter',
  pulse: 'manager',
  zenith: 'dominator',
  starter: 'starter',
  manager: 'manager',
  dominator: 'dominator',
};

function isValidPlan(plan: string | null): plan is PlanType {
  return plan !== null && PLAN_TYPES.includes(plan as PlanType);
}

/**
 * Page checkout : uniquement écran noir + logo pulsant + redirection auto vers Stripe.
 * Plus de bouton intermédiaire.
 */
export default function CheckoutPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, setLoading] = useState(false);

  const planParam = searchParams.get('plan');
  const hasValidPlan = planParam && ['vision', 'pulse', 'zenith'].includes(planParam);
  const plan: PlanType = isValidPlan(planParam) ? planParam : 'pulse';
  const stripePlan = PLAN_TO_STRIPE[plan] ?? 'manager';
  const skipTrial = searchParams.get('trial') === '0';
  const annual = searchParams.get('annual') === '1';
  const autoRedirect = searchParams.get('auto') === '1';

  const triggerCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const hasQtyParam = searchParams.has('quantity');
      let qty = Math.min(
        15,
        Math.max(1, parseInt(searchParams.get('quantity') ?? '1', 10) || 1)
      );
      if (!hasQtyParam || qty === 1) {
        try {
          const intent = getCheckoutIntent();
          if (intent?.plan === plan && typeof intent.quantity === 'number' && intent.quantity > 1) {
            qty = Math.min(15, Math.max(1, intent.quantity));
          }
        } catch {
          /* ignore */
        }
      }
      const params = new URLSearchParams({
        locale,
        planType: stripePlan,
        planSlug: plan,
        quantity: String(qty),
      });
      if (skipTrial) params.set('skipTrial', '1');
      if (annual) params.set('annual', '1');
      const res = await fetch(`/api/stripe/create-checkout?${params}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      router.replace(`/${locale}/dashboard`);
    } catch {
      router.replace(`/${locale}/dashboard`);
    }
  }, [locale, stripePlan, plan, skipTrial, annual, searchParams, router]);

  useEffect(() => {
    if (autoRedirect && hasValidPlan) {
      triggerCheckout();
      return;
    }
    if (!autoRedirect || !hasValidPlan) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [autoRedirect, hasValidPlan, triggerCheckout, locale, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <motion.div
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: CHECKOUT_MOTION_EASE }}
        className="flex flex-col items-center"
      >
        <Logo size="lg" />
      </motion.div>
    </div>
  );
}
