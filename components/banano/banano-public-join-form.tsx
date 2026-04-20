'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AuthTurnstile } from '@/components/auth/turnstile';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { getRegionCodeForSiteLocale } from '@/lib/i18n/locale-region';

type Props = {
  slug: string;
  establishmentName: string | null;
};

const PUBLIC_JOIN_PHONE_NUMBER_INPUT_PROPS = { autoComplete: 'tel' as const };

function stableDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';
  try {
    let v = sessionStorage.getItem('reputexa_enroll_device');
    if (!v) {
      v = `ew_${crypto.randomUUID()}_${Date.now()}`;
      sessionStorage.setItem('reputexa_enroll_device', v);
    }
    return v;
  } catch {
    return `ew_fallback_${Date.now()}`;
  }
}

export function BananoPublicJoinForm({ slug, establishmentName }: Props) {
  const t = useTranslations('Dashboard.bananoPublicJoin');
  const locale = useLocale();
  const defaultCountry = useMemo(() => getRegionCodeForSiteLocale(locale), [locale]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{
    smartWalletUrl: string;
    walletQrPayload: string;
  } | null>(null);

  const fp = useMemo(() => stableDeviceFingerprint(), []);

  const submit = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/banano/public/loyalty-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          birthDate: birthDate.trim() || undefined,
          deviceFingerprint: fp || undefined,
          turnstileToken: turnstileToken ?? undefined,
          defaultCountry,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        smartWalletUrl?: string;
        walletQrPayload?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? t('errEnroll'));
        return;
      }
      if (data.smartWalletUrl && data.walletQrPayload) {
        setDone({ smartWalletUrl: data.smartWalletUrl, walletQrPayload: data.walletQrPayload });
      }
    } catch {
      setErr(t('errNetwork'));
    } finally {
      setBusy(false);
    }
  }, [slug, firstName, lastName, phone, birthDate, fp, turnstileToken, t, defaultCountry]);

  if (done) {
    return (
      <div className="space-y-6 text-center max-w-md mx-auto px-4 py-10">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm">
          {t('successCard')}
        </div>
        <a
          href={`${done.smartWalletUrl}&fmt=json`}
          className="inline-flex items-center justify-center rounded-xl bg-white text-zinc-900 font-medium px-5 py-3 text-sm w-full"
        >
          {t('ctaWallet')}
        </a>
        <p className="text-xs text-zinc-500 break-all font-mono">{done.walletQrPayload}</p>
      </div>
    );
  }

  const brand = establishmentName?.trim() || t('brandFallback');

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{brand}</h1>
        <p className="text-sm text-zinc-400">{t('subtitle')}</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <label className="block text-xs font-medium text-zinc-400">
          {t('labelFirstName')}
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-400">
          {t('labelLastName')}
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </label>
        <div className="block text-xs font-medium text-zinc-400">
          <span className="block mb-1">{t('labelPhone')}</span>
          <PhoneInput
            id="banano-public-phone"
            value={phone}
            onChange={(v) => setPhone(v ?? '')}
            defaultCountry={defaultCountry}
            placeholder={t('phonePlaceholder')}
            containerClassName="w-full"
            surface="onDark"
            numberInputProps={PUBLIC_JOIN_PHONE_NUMBER_INPUT_PROPS}
          />
        </div>
        <label className="block text-xs font-medium text-zinc-400">
          {t('labelBirth')}
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </label>

        <AuthTurnstile
          action="banano_join"
          onVerify={(t) => setTurnstileToken(t)}
          onExpire={() => setTurnstileToken(null)}
        />

        {err ? (
          <p className="text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        <button
          type="button"
          disabled={
            busy ||
            !firstName.trim() ||
            !lastName.trim() ||
            !phone.trim() ||
            !isValidPhoneNumber(phone)
          }
          onClick={() => void submit()}
          className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium py-3 text-sm transition-colors"
        >
          {busy ? t('busy') : t('ctaSubmit')}
        </button>
      </div>
    </div>
  );
}
