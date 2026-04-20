import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';

const grandCentralRich = {
  green: (chunks: ReactNode) => <strong className="text-zinc-300">{chunks}</strong>,
  orange: (chunks: ReactNode) => <strong className="text-amber-200">{chunks}</strong>,
  red: (chunks: ReactNode) => <strong className="text-red-200">{chunks}</strong>,
  halls: (chunks: ReactNode) => <strong className="text-zinc-300">{chunks}</strong>,
  m: (chunks: ReactNode) => <strong className="text-zinc-300">{chunks}</strong>,
  hint: (chunks: ReactNode) => <strong className="text-zinc-400">{chunks}</strong>,
};

/**
 * Guide d’usage du Grand Central (accordion sur la page admin d’accueil).
 */
export async function AdminGrandCentralGuide() {
  const t = await getTranslations('Dashboard.adminGrandCentralGuide');

  return (
    <AdminGuidePanel title={t('panelTitle')}>
      <div className="space-y-4">
        <section>
          <h3 className="text-zinc-200 font-semibold text-xs uppercase tracking-wide mb-1">{t('s1Title')}</h3>
          <ul className="list-disc pl-4 space-y-1">
            <li>{t.rich('s1Li1Rich', grandCentralRich)}</li>
            <li>{t.rich('s1Li2Rich', grandCentralRich)}</li>
            <li>{t.rich('s1Li3Rich', grandCentralRich)}</li>
            <li>{t.rich('s1Li4Rich', grandCentralRich)}</li>
          </ul>
        </section>

        <section>
          <h3 className="text-zinc-200 font-semibold text-xs uppercase tracking-wide mb-1">{t('s2Title')}</h3>
          <ul className="list-disc pl-4 space-y-2 text-[11px]">
            <li>{t.rich('s2Li1Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li2Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li3Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li4Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li5Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li6Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li7Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li8Rich', grandCentralRich)}</li>
            <li>{t.rich('s2Li9Rich', grandCentralRich)}</li>
          </ul>
        </section>

        <p className="text-zinc-500 text-[11px] border-t border-zinc-800/80 pt-2">{t.rich('footerRich', grandCentralRich)}</p>
      </div>
    </AdminGuidePanel>
  );
}
