'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { PasskeyEnrollButton } from '@/components/auth/passkey-enroll-button';
import { TotpMfaEnroll } from '@/components/auth/totp-mfa-enroll';
import { Fingerprint, Loader2, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type MfaFactor = {
  id: string;
  factor_type: string;
  friendly_name?: string;
  status: string;
};

/**
 * Section sécurité MFA (TOTP + passkeys) — texte entièrement piloté par la locale.
 */
export function SecurityKeysPanel() {
  const t = useTranslations('Dashboard.settings');
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setFactors([]);
        return;
      }
      setFactors((data?.all ?? []) as MfaFactor[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const securityFactors = factors.filter(
    (f) =>
      (f.factor_type === 'totp' || f.factor_type === 'webauthn') && f.status === 'verified',
  );

  async function removeFactor(factorId: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('toastSecurityFactorRemoved'));
    void refresh();
  }

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
        {t.rich('securityPanelIntro', {
          magiclink: (chunks) => <strong>{chunks}</strong>,
          secondfactor: (chunks) => <strong>{chunks}</strong>,
          totpapp: (chunks) => <strong>{chunks}</strong>,
          authdash: (chunks) => <strong>{chunks}</strong>,
          passkey: (chunks) => <strong>{chunks}</strong>,
          webauthn: (chunks) => <strong>{chunks}</strong>,
          support: (chunks) => (
            <a
              href="https://supabase.com/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563eb] hover:underline"
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-950/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500 mb-3">
          {t('securityRegisteredSectionTitle')}
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('securityLoading')}
          </div>
        ) : securityFactors.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-zinc-400">{t('securityNoFactors')}</p>
        ) : (
          <ul className="space-y-2">
            {securityFactors.map((f) => {
              const isTotp = f.factor_type === 'totp';
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-800 dark:text-zinc-200 min-w-0">
                    {isTotp ? (
                      <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                    ) : (
                      <Fingerprint className="w-4 h-4 text-[#2563eb] shrink-0" aria-hidden />
                    )}
                    <span className="truncate">
                      <span className="font-medium">
                        {isTotp ? t('securityFactorTotpLabel') : t('securityFactorPasskeyLabel')}
                      </span>
                      {f.friendly_name ? (
                        <span className="text-slate-500 dark:text-zinc-500"> · {f.friendly_name}</span>
                      ) : null}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeFactor(f.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                    {t('securityRemoveFactor')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
          {t('securityStep1Title')}
        </p>
        <TotpMfaEnroll onEnrolled={refresh} />
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
          {t('securityStep2Title')}
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">{t('securityStep2Hint')}</p>
        <PasskeyEnrollButton variant="primary" className="w-full sm:w-auto justify-center" onEnrolled={refresh} />
      </div>
    </div>
  );
}
