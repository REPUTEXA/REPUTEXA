'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';

const adminHomeGuideRichTags = {
  b: (chunks: ReactNode) => <strong className="text-zinc-300">{chunks}</strong>,
  mono: (chunks: ReactNode) => <span className="font-mono text-zinc-500">{chunks}</span>,
  path: (chunks: ReactNode) => <span className="font-mono text-zinc-500">{chunks}</span>,
  code: (chunks: ReactNode) => <code className="text-zinc-400">{chunks}</code>,
};

/** Carte module hub : le lien ou le contenu principal uniquement (explications → pages / overlay dédiés). */
export function AdminHubModuleCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950/30 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] ring-1 ring-black/40 transition-[border-color,box-shadow] duration-200 hover:border-zinc-700/70 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]">
      {children}
    </div>
  );
}

/** @deprecated Utiliser AdminHubModuleCard */
export const AdminHomeGuideBelow = AdminHubModuleCard;

/** Guide simple — Sécurité & Perfection (comme la page dédiée). */
export function SecurityPerfectionHomeGuideBody() {
  const t = useTranslations('Dashboard.adminHomeGuides.securityPerfection');
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s1Title')}</h3>
        <p>{t.rich('s1Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s2Title')}</h3>
        <p>{t.rich('s2Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s3Title')}</h3>
        <p>{t.rich('s3Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s4Title')}</h3>
        <p>{t.rich('s4Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s5Title')}</h3>
        <p>{t.rich('s5Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s6Title')}</h3>
        <p>{t.rich('s6Rich', adminHomeGuideRichTags)}</p>
      </section>
    </div>
  );
}

export function BlackBoxHomeGuideBody() {
  const t = useTranslations('Dashboard.adminHomeGuides.blackBox');
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s1Title')}</h3>
        <p>{t.rich('s1Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s2Title')}</h3>
        <p>{t.rich('s2Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s3Title')}</h3>
        <ul className="list-disc pl-4 space-y-1">
          <li>{t.rich('s3Li1Rich', adminHomeGuideRichTags)}</li>
          <li>{t.rich('s3Li2Rich', adminHomeGuideRichTags)}</li>
          <li>{t.rich('s3Li3Rich', adminHomeGuideRichTags)}</li>
        </ul>
      </section>
    </div>
  );
}

export function IaForgeHomeGuideBody() {
  const t = useTranslations('Dashboard.adminHomeGuides.iaForge');
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s1Title')}</h3>
        <p>{t.rich('s1Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s2Title')}</h3>
        <p>{t.rich('s2Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s3Title')}</h3>
        <p>{t.rich('s3Rich', adminHomeGuideRichTags)}</p>
      </section>
    </div>
  );
}

export function NexusHomeGuideBody() {
  const t = useTranslations('Dashboard.adminHomeGuides.nexus');
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s1Title')}</h3>
        <p>{t.rich('s1Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s2Title')}</h3>
        <p>{t.rich('s2Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s3Title')}</h3>
        <p>{t.rich('s3Rich', adminHomeGuideRichTags)}</p>
      </section>
    </div>
  );
}

export function CodeGuardianHomeGuideBody() {
  const t = useTranslations('Dashboard.adminHomeGuides.codeGuardian');
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s1Title')}</h3>
        <p>{t.rich('s1Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s2Title')}</h3>
        <p>{t.rich('s2Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s3Title')}</h3>
        <p>{t.rich('s3Rich', adminHomeGuideRichTags)}</p>
      </section>
    </div>
  );
}

export function LegalPublishHomeGuideBody() {
  const t = useTranslations('Dashboard.adminHomeGuides.legalPublish');
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s1Title')}</h3>
        <p>{t.rich('s1Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s2Title')}</h3>
        <p>{t.rich('s2Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s3Title')}</h3>
        <p>{t.rich('s3Rich', adminHomeGuideRichTags)}</p>
      </section>
    </div>
  );
}

export function AuditKitHomeGuideBody() {
  const t = useTranslations('Dashboard.adminHomeGuides.auditKit');
  return (
    <div className="space-y-3">
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s1Title')}</h3>
        <p>{t.rich('s1Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s2Title')}</h3>
        <p>{t.rich('s2Rich', adminHomeGuideRichTags)}</p>
      </section>
      <section>
        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('s3Title')}</h3>
        <p>{t.rich('s3Rich', adminHomeGuideRichTags)}</p>
      </section>
    </div>
  );
}

/** Accordion « Kit dossier contrôle » pour la page dédiée (importable depuis une page RSC). */
export function AuditKitPageGuideAccordion() {
  const t = useTranslations('Dashboard.adminHomeGuides.auditKit');
  return (
    <AdminGuidePanel title={t('accordionTitle')}>
      <AuditKitHomeGuideBody />
    </AdminGuidePanel>
  );
}
