'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { FileDown, FileText, ScrollText, Sparkles, Scale } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsComplianceBlock() {
  const t = useTranslations('Dashboard.compliancePage');
  const tShell = useTranslations('Dashboard.shell');
  const locale = useLocale();
  const [establishmentName, setEstablishmentName] = useState<string | null>(null);
  const [complianceOk, setComplianceOk] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('establishment_name, legal_compliance_accepted')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        setEstablishmentName((data as { establishment_name?: string }).establishment_name ?? null);
        setComplianceOk(!!(data as { legal_compliance_accepted?: boolean }).legal_compliance_accepted);
      }
    });
  }, []);

  const downloadCertificate = useCallback(async () => {
    try {
      const res = await fetch(`/api/compliance/certificate?locale=${encodeURIComponent(locale)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === 'string' ? j.error : res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reputexa-compliance-certificate.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('certificateToastOk'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('certificateToastErr'));
    }
  }, [locale, t]);

  const openPoster = useCallback(() => {
    const name = establishmentName?.trim() || tShell('defaultEstablishment');
    const params = new URLSearchParams({
      establishmentName: name,
      paper: 'A4',
      locale,
    });
    window.open(`/api/compliance-poster?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }, [establishmentName, locale, tShell]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/95 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] dark:shadow-none p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center flex-shrink-0">
          <Scale className="w-5 h-5 text-sky-600 dark:text-sky-400" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold text-[17px] tracking-tight text-slate-900 dark:text-zinc-100">
            {t('title')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">{t('intro')}</p>
          <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            {t('tagline')}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-zinc-100 font-medium text-sm">
            <ScrollText className="w-4 h-4 text-sky-600 shrink-0" aria-hidden />
            {t('art30Title')}
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{t('art30Body')}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/docs/registre-traitements-art30-reputexa.csv"
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-2"
            >
              <FileDown className="w-3.5 h-3.5" />
              {t('csvCta')}
            </a>
            <a
              href="/docs/registre-rgpd-reputexa.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-medium px-3 py-2 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              {t('htmlCtalabel')}
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-zinc-100 font-medium text-sm">
            <FileText className="w-4 h-4 text-violet-600 shrink-0" aria-hidden />
            {t('certificateTitle')}
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{t('certificateBody')}</p>
          <button
            type="button"
            onClick={() => void downloadCertificate()}
            disabled={complianceOk === false}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-45 text-white text-xs font-medium px-3 py-2"
          >
            <FileDown className="w-3.5 h-3.5" />
            {t('certificateCta')}
          </button>
          {complianceOk === false && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">{t('certificateBlockedHint')}</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-medium text-sm text-slate-900 dark:text-zinc-100">{t('posterTitle')}</div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">{t('posterBody')}</p>
          </div>
          <button
            type="button"
            onClick={openPoster}
            className="shrink-0 rounded-lg border border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200 text-xs font-medium px-3 py-2"
          >
            {t('posterCta')}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-4">
        {t('collecteHint')}{' '}
        <Link href="/dashboard/whatsapp-review?tab=collecte" className="text-sky-600 dark:text-sky-400 font-medium hover:underline">
          {t('linkCollecte')}
        </Link>
      </p>
    </section>
  );
}
