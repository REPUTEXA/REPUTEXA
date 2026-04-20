'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { LegalPublishForm } from '@/components/admin/legal-publish-form';
import { AdminBroadcastEmailForm } from '@/components/admin/admin-broadcast-email-form';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import { LegalPublishHomeGuideBody } from '@/components/admin/admin-dashboard-home-guides';

type Props = { adminSecret: string };

export function AdminLegalWorkspace({ adminSecret }: Props) {
  const t = useTranslations('Admin.legalWorkspace');
  /** Fermés par défaut : déplier pour travailler. Le contenu reste monté (masqué) pour ne pas perdre les brouillons. */
  const [legalOpen, setLegalOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  return (
    <div className="space-y-4">
      <AdminGuidePanel title={t('guidePanelTitle')}>
        <LegalPublishHomeGuideBody />
      </AdminGuidePanel>

      {/* — Publication légale — */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <button
          type="button"
          aria-expanded={legalOpen}
          onClick={() => setLegalOpen((o) => !o)}
          className={`flex w-full items-center gap-3 px-5 py-4 bg-zinc-900/60 text-left hover:bg-zinc-900/80 transition-colors ${
            legalOpen ? 'border-b border-zinc-800/80' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-600/25 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-200">{t('publishSectionTitle')}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{t('publishSectionDescription')}</p>
          </div>
          {legalOpen ? (
            <ChevronUp className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          )}
        </button>
        <div className={legalOpen ? 'px-5 py-5' : 'hidden'} aria-hidden={!legalOpen}>
          <LegalPublishForm adminSecret={adminSecret} />
        </div>
      </div>

      {/* — Diffusion information — */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        <button
          type="button"
          aria-expanded={broadcastOpen}
          onClick={() => setBroadcastOpen((o) => !o)}
          className={`flex w-full items-center gap-3 px-5 py-4 bg-zinc-900/60 text-left hover:bg-zinc-900/80 transition-colors ${
            broadcastOpen ? 'border-b border-zinc-800/80' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-amber-600/15 border border-amber-600/25 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-200">{t('broadcastSectionTitle')}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{t('broadcastSectionDescription')}</p>
          </div>
          {broadcastOpen ? (
            <ChevronUp className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          )}
        </button>
        <div className={broadcastOpen ? 'px-5 py-5' : 'hidden'} aria-hidden={!broadcastOpen}>
          <AdminBroadcastEmailForm adminSecret={adminSecret} />
        </div>
      </div>
    </div>
  );
}
