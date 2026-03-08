'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { hasFeature, FEATURES, toPlanSlug } from '@/lib/feature-gate';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import { Lock } from 'lucide-react';

export default function AlertsPage() {
  const [planSlug, setPlanSlug] = useState<'vision' | 'pulse' | 'zenith' | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('subscription_plan, selected_plan')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          const slug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
          setPlanSlug(slug);
        });
    });
  }, []);

  const canAccess = planSlug !== null && hasFeature(planSlug, FEATURES.WHATSAPP_ALERTS);

  if (planSlug !== null && !canAccess) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <h1 className="font-display font-bold text-2xl text-slate-900 flex items-center gap-2">
          Alertes
          <span className="text-amber-500" title="Réservé Pulse">🔒</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Alertes WhatsApp pour avis négatifs — réservé aux membres Pulse et Zenith
        </p>
        <div className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <p className="text-slate-700 font-medium mb-1">
            Cette fonctionnalité est réservée aux membres <strong>Pulse</strong> ou <strong>Zenith</strong>.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Recevez des alertes WhatsApp immédiates dès qu&apos;un avis négatif est détecté.
          </p>
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Passer au plan Pulse
          </button>
        </div>
        {showUpgradeModal && (
          <UpgradeModal
            featureKey={FEATURES.WHATSAPP_ALERTS}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <h1 className="font-display font-bold text-2xl text-slate-900">Alertes</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Gérez vos alertes et notifications WhatsApp
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-slate-500">Page Alertes — Fonctionnalité à venir.</p>
      </div>
    </div>
  );
}
