'use client';

import { useTranslations } from 'next-intl';
import { Scale, Download, FileText } from 'lucide-react';

const REGISTRE_CSV_HREF = '/docs/registre-traitements-art30-reputexa.csv';
const REGISTRE_HTML_HREF = '/docs/registre-rgpd-reputexa.html';

export function RegistrePreview() {
  const t = useTranslations('SecurityPage.registre');

  const rows = [
    { treatmentKey: 'row1Treatment', purposeKey: 'row1Purpose', basisKey: 'row1Basis' },
    { treatmentKey: 'row2Treatment', purposeKey: 'row2Purpose', basisKey: 'row2Basis' },
    { treatmentKey: 'row3Treatment', purposeKey: 'row3Purpose', basisKey: 'row3Basis' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#2563eb]/25 text-blue-200 border border-blue-500/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          {t('badgeArticle30')}
        </span>
        <span className="rounded-full bg-violet-500/20 text-violet-200 border border-violet-500/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          {t('badgeNative')}
        </span>
      </div>

      <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">{t('intro')}</p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
          <div className="bg-[#0c1220] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {t('colTreatment')}
          </div>
          <div className="bg-[#0c1220] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {t('colPurpose')}
          </div>
          <div className="bg-[#0c1220] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {t('colLegalBasis')}
          </div>
        </div>
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] border-t border-white/10"
          >
            <div className="bg-[#0a0f18] px-4 py-4 text-sm text-gray-200 leading-relaxed">
              {t(row.treatmentKey)}
            </div>
            <div className="bg-[#0a0f18] px-4 py-4 text-sm text-gray-400 leading-relaxed">
              {t(row.purposeKey)}
            </div>
            <div className="bg-[#0a0f18] px-4 py-4 text-sm text-gray-400 leading-relaxed">
              {t(row.basisKey)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <a
            href={REGISTRE_CSV_HREF}
            download
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 hover:brightness-110 active:scale-[0.99] transition-all"
          >
            <Download className="w-4 h-4" aria-hidden />
            {t('downloadCta')}
          </a>
          <a
            href={REGISTRE_HTML_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 active:scale-[0.99] transition-all"
          >
            <FileText className="w-4 h-4" aria-hidden />
            {t('htmlRegisterCta')}
          </a>
        </div>
        <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
          <span className="block sm:inline sm:after:content-['\00a0·\00a0']">{t('downloadHint')}</span>
          <span className="block sm:inline">{t('htmlRegisterHint')}</span>
        </p>
      </div>
    </div>
  );
}

export function RegistreSectionHeader({
  className = '',
  as: Comp = 'h2',
}: {
  className?: string;
  as?: 'h2' | 'h3';
}) {
  const t = useTranslations('SecurityPage.registre');
  const titleClass =
    Comp === 'h3'
      ? 'font-display text-base sm:text-lg font-bold text-white'
      : 'font-display text-xl font-bold text-white';
  return (
    <div className={`flex items-center gap-3 mb-6 ${className}`.trim()}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30">
        <Scale className="w-5 h-5 text-violet-300" aria-hidden />
      </div>
      <Comp className={titleClass}>{t('sectionTitle')}</Comp>
    </div>
  );
}
