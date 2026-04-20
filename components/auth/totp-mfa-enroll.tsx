'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { Loader2, Shield } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

type Props = {
  onEnrolled: () => void;
};

/**
 * Enrôlement MFA TOTP (Google Authenticator, Authy, 1Password, etc.).
 */
export function TotpMfaEnroll({ onEnrolled }: Props) {
  const t = useTranslations('Dashboard.settings');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'idle' | 'qr'>('idle');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const reset = useCallback(() => {
    setStep('idle');
    setFactorId(null);
    setQrDataUrl(null);
    setSecret(null);
    setCode('');
    setShowSecret(false);
  }, []);

  const cleanupUnverified = useCallback(async (id: string | null) => {
    if (!id) return;
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: id });
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const friendly = t('mfaFactorFriendlyName', {
        date: new Date().toLocaleDateString(siteLocaleToIntlDateTag(locale)),
      });
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: friendly,
        issuer: 'REPUTEXA',
      });
      if (error) throw error;
      if (!data?.totp?.qr_code) throw new Error(t('totpErrIncompleteResponse'));
      setFactorId(data.id);
      const qr = data.totp.qr_code.startsWith('data:')
        ? data.totp.qr_code
        : `data:image/svg+xml;utf-8,${data.totp.qr_code}`;
      setQrDataUrl(qr);
      setSecret(data.totp.secret);
      setStep('qr');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('totpErrPrepareQr'));
    } finally {
      setBusy(false);
    }
  }, [locale, t]);

  const verify = useCallback(async () => {
    const id = factorId;
    const c = code.replace(/\D/g, '').slice(0, 6);
    if (!id || c.length !== 6) {
      toast.error(t('totpErrEnterSixDigits'));
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: c });
      if (error) throw error;
      toast.success(t('totpToastAppRegistered'));
      reset();
      onEnrolled();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('totpErrVerifyFallback'));
    } finally {
      setBusy(false);
    }
  }, [code, factorId, onEnrolled, reset, t]);

  const cancel = useCallback(async () => {
    await cleanupUnverified(factorId);
    reset();
  }, [cleanupUnverified, factorId, reset]);

  if (step === 'qr' && qrDataUrl && factorId) {
    return (
      <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-4">
        <p className="text-sm text-slate-700 dark:text-zinc-300">
          {t.rich('totpScanDescription', {
            ga: (chunks) => <strong>{chunks}</strong>,
            au: (chunks) => <strong>{chunks}</strong>,
            op: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <div className="flex justify-center rounded-lg bg-white p-3 dark:bg-zinc-900">
          <Image
            src={qrDataUrl}
            alt={t('totpQrAlt')}
            width={160}
            height={160}
            className="h-40 w-40 max-w-full"
            unoptimized
          />
        </div>
        {secret ? (
          <div className="text-xs">
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            >
              {showSecret ? t('totpHideSecret') : t('totpShowSecret')}
            </button>
            {showSecret ? (
              <p className="mt-2 font-mono break-all rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                {secret}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="totp-verify-code" className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
              {t('totpCodeLabel')}
            </label>
            <input
              id="totp-verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 px-4 py-2.5 font-mono text-lg tracking-[0.2em] text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
              placeholder={t('totpCodePlaceholder')}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={busy}
              className="rounded-xl border border-slate-200 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {t('totpCancel')}
            </button>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={busy || code.length !== 6}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('totpVerify')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={busy}
      className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-800/60 py-3 px-4 text-sm font-semibold text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700/50 disabled:opacity-50 transition-colors"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Shield className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
      {busy ? t('totpBusyPreparing') : t('totpAddButton')}
    </button>
  );
}
