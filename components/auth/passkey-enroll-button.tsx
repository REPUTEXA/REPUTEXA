'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Fingerprint, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

function mapPasskeyError(raw: string, t: ReturnType<typeof useTranslations<'Dashboard.settings'>>): string {
  const m = raw.trim();
  const low = m.toLowerCase();
  if (low.includes('mfa enroll is disabled') && low.includes('webauthn')) {
    return t('passkeyErrWebauthnDisabled');
  }
  if (low.includes('enroll is disabled')) {
    return t('passkeyErrMfaDisabled');
  }
  if (low.includes('browser does not support webauthn')) {
    return t('passkeyErrBrowserUnsupported');
  }
  return m;
}

type Props = {
  /** Libellé du facteur (surcharge ; défaut = REPUTEXA · date locale) */
  friendlyName?: string;
  className?: string;
  variant?: 'primary' | 'secondary';
  onEnrolled?: () => void;
};

/**
 * Enrôlement passkey / WebAuthn (facteur MFA Supabase).
 */
export function PasskeyEnrollButton({
  friendlyName: friendlyNameProp,
  className = '',
  variant = 'secondary',
  onEnrolled,
}: Props) {
  const t = useTranslations('Dashboard.settings');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const defaultFriendlyName = useMemo(
    () =>
      t('mfaFactorFriendlyName', {
        date: new Date().toLocaleDateString(siteLocaleToIntlDateTag(locale)),
      }),
    [locale, t],
  );

  const friendlyName = friendlyNameProp ?? defaultFriendlyName;

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const mfa = supabase.auth.mfa as {
        webauthn?: { register: (p: { friendlyName: string }) => Promise<{ data: unknown; error: Error | null }> };
      };
      const webauthn = mfa.webauthn;
      if (!webauthn?.register) {
        toast.error(t('passkeyErrUnavailableSdk'));
        return;
      }
      const { data, error } = await webauthn.register({ friendlyName });
      if (error) throw error;
      if (!data) throw new Error(t('passkeyErrIncomplete'));
      toast.success(t('passkeyToastSuccess'), { duration: 5000 });
      onEnrolled?.();
    } catch (e) {
      const raw =
        e instanceof Error
          ? e.message
          : t('passkeyErrGenericFallback');
      toast.error(mapPasskeyError(raw, t));
    } finally {
      setBusy(false);
    }
  }, [friendlyName, onEnrolled, t]);

  const base =
    variant === 'primary'
      ? 'py-3 px-4 rounded-xl font-semibold text-white bg-primary hover:brightness-110 border border-transparent'
      : 'py-2.5 px-4 rounded-xl font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-700/50';

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none ${base} ${className}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Fingerprint className="w-4 h-4 shrink-0" />}
      {busy ? t('passkeyButtonBusy') : t('passkeyButtonLabel')}
    </button>
  );
}
