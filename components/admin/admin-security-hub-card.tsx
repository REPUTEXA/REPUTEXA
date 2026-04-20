'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Crosshair, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { SecurityPerfectionClient } from '@/components/admin/security-perfection-client';
import { AdminModalPortal } from '@/components/admin/admin-modal-portal';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import { SecurityPerfectionHomeGuideBody } from '@/components/admin/admin-dashboard-home-guides';

/**
 * Carte hub : même silhouette que les autres modules admin, avec panneau intégré + accès page complète + overlay rapide.
 */
export function AdminSecurityHubCard() {
  const t = useTranslations('Admin.securityHubCard');
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950/30 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] ring-1 ring-black/40">
      <div className="flex flex-col border-b border-zinc-800/50 min-[480px]:flex-row min-[480px]:items-stretch">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={t('openCardTitle')}
          className="group flex flex-1 items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/40">
            <Crosshair className="h-5 w-5 text-rose-400/90" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">{t('cardHeading')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{t('cardSubtitle')}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
        </button>
        <Link
          href="/dashboard/admin/security-perfection"
          className="flex items-center justify-center gap-1 whitespace-nowrap border-zinc-800/50 px-4 py-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800/30 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50 min-[480px]:border-l"
        >
          {t('linkFullPage')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {open ? (
        <AdminModalPortal>
          <div
            className="fixed inset-0 z-[9600] flex items-center justify-center p-3 sm:p-6"
            style={{
              paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[10px] sm:backdrop-blur-xl"
              aria-label={t('ariaClose')}
              onClick={() => setOpen(false)}
            />
            <div
              className="relative z-10 w-full max-w-3xl max-h-[min(92dvh,calc(100dvh-1.5rem))] flex flex-col rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden ring-1 ring-white/5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="security-perfection-overlay-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-rose-600/25 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <Crosshair className="w-5 h-5 text-rose-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 id="security-perfection-overlay-title" className="text-sm font-bold text-white tracking-tight">
                    {t('cardHeading')}
                  </h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{t('overlaySubtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                  aria-label={t('ariaClose')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4">
                <AdminGuidePanel title={t('guidePanelTitle')} variant="compact">
                  <SecurityPerfectionHomeGuideBody />
                </AdminGuidePanel>
                <SecurityPerfectionClient variant="overlay" />
              </div>
            </div>
          </div>
        </AdminModalPortal>
      ) : null}
    </div>
  );
}
