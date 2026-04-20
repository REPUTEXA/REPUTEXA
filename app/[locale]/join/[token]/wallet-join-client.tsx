'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { computeWalletDeviceFingerprintHex } from '@/lib/wallet/device-fingerprint';

type Props = {
  merchantId: string;
  establishmentName: string;
  locale: string;
};

export function WalletJoinClient({ merchantId, establishmentName, locale }: Props) {
  const t = useTranslations('JoinWallet');
  const tAuth = useTranslations('Auth');
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<'boot' | 'oauth' | 'birth' | 'done'>('boot');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    smartWalletUrl: string;
    walletQrPayload: string;
  } | null>(null);

  const autoStarted = useRef(false);

  const brand = establishmentName.trim() || 'REPUTEXA';

  const runComplete = useCallback(
    async (birth: string) => {
      setError(null);
      setLoading(true);
      try {
        const fp = await computeWalletDeviceFingerprintHex();
        if (!fp || fp.length < 32) {
          setError(t('errGeneric'));
          setPhase('birth');
          return false;
        }
        const res = await fetch('/api/banano/wallet/oauth-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            merchantId,
            birthDate: birth,
            deviceFingerprint: fp,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          smartWalletUrl?: string;
          walletQrPayload?: string;
        };
        if (!res.ok) {
          if (data.code === 'identity_duplicate') {
            setError(tAuth('error_identity_duplicate'));
          } else if (data.code === 'device_fingerprint_fraud') {
            setError(tAuth('error_device_fingerprint_blocked'));
          } else {
            setError(typeof data.error === 'string' ? data.error : t('errGeneric'));
          }
          setBirthDate(birth);
          setPhase('birth');
          autoStarted.current = false;
          return false;
        }
        if (data.smartWalletUrl && data.walletQrPayload) {
          setDone({
            smartWalletUrl: data.smartWalletUrl,
            walletQrPayload: data.walletQrPayload,
          });
          setPhase('done');
          const joiner = data.smartWalletUrl.includes('?') ? '&' : '?';
          void fetch(`${data.smartWalletUrl}${joiner}fmt=json`, { credentials: 'same-origin' }).catch(
            () => {}
          );
          return true;
        }
      } catch {
        setError(t('errGeneric'));
        setPhase('birth');
        autoStarted.current = false;
        return false;
      } finally {
        setLoading(false);
      }
      return false;
    },
    [merchantId, t, tAuth]
  );

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPhase('oauth');
        return;
      }
      await fetch('/api/auth/sync-oauth-profile', { method: 'POST' }).catch(() => {});
      const { data: prof } = await supabase
        .from('profiles')
        .select('wallet_birth_date')
        .eq('id', session.user.id)
        .maybeSingle();
      const b = (prof as { wallet_birth_date?: string | null } | null)?.wallet_birth_date;
      if (b && /^\d{4}-\d{2}-\d{2}$/.test(b)) {
        setBirthDate(b);
        if (!autoStarted.current) {
          autoStarted.current = true;
          await runComplete(b);
        }
        return;
      }
      setPhase('birth');
    })();
  }, [supabase, runComplete]);

  const oauth = useCallback(
    async (provider: 'google' | 'apple') => {
      setError(null);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const next = `/${locale}/join/${merchantId}`;
      const redirectTo = `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: oErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oErr) setError(oErr.message);
    },
    [locale, merchantId, supabase]
  );

  async function onSubmitBirth(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError(t('errGeneric'));
      return;
    }
    if (!autoStarted.current) {
      autoStarted.current = true;
      await runComplete(birthDate);
    }
  }

  async function signOutAndRetry() {
    await supabase.auth.signOut();
    autoStarted.current = false;
    setError(null);
    setPhase('oauth');
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col space-y-6 px-4 py-8 text-center">
        <p className="text-sm text-emerald-100">{t('successLine')}</p>
        <a
          href={`${done.smartWalletUrl}${done.smartWalletUrl.includes('?') ? '&' : '?'}fmt=json`}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-zinc-900"
        >
          {t('ctaWallet')}
        </a>
        <p className="text-xs text-zinc-500">{t('scanPayloadCaption')}</p>
        <p className="break-all font-mono text-xs text-zinc-500">{done.walletQrPayload}</p>
      </div>
    );
  }

  if (phase === 'boot') {
    return (
      <div className="flex min-h-[40dvh] flex-col items-center justify-center px-4">
        <p className="text-sm text-zinc-400">{t('busy')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-6 px-4 py-6 pb-12">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {t('title', { shop: brand })}
        </h1>
        <p className="text-sm text-zinc-400">{t('subtitle')}</p>
      </div>

      {phase === 'oauth' ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-xs text-zinc-500">{t('hintOAuthFirst')}</p>
          <button
            type="button"
            onClick={() => void oauth('google')}
            className="min-h-[52px] w-full rounded-xl bg-white text-[15px] font-semibold text-zinc-900 shadow-lg shadow-black/20 transition-transform active:scale-[0.99]"
          >
            {t('ctaGoogle')}
          </button>
          <button
            type="button"
            onClick={() => void oauth('apple')}
            className="min-h-[52px] w-full rounded-xl border border-white/10 bg-black text-[15px] font-semibold text-white transition-transform active:scale-[0.99]"
          >
            {t('ctaApple')}
          </button>
          {error ? (
            <p className="text-center text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === 'birth' ? (
        <form
          onSubmit={(e) => void onSubmitBirth(e)}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
        >
          <label className="block text-left text-xs font-medium text-zinc-400">
            {t('birthLabel')}
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-2 min-h-[48px] w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-base text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </label>
          <p className="text-xs text-zinc-500">{t('birthHelper')}</p>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !birthDate}
            className="min-h-[52px] w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
          >
            {loading ? t('busy') : t('ctaContinue')}
          </button>
          <button
            type="button"
            onClick={() => void signOutAndRetry()}
            className="w-full text-center text-xs text-zinc-500 underline"
          >
            {t('signOut')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
