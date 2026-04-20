'use client';

import { useState, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { BrandLoadingOverlay } from '@/components/brand/brand-page-loader';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function BananoPinResetForm() {
  const t = useTranslations('BananoPinReset');
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [pinA, setPinA] = useState('');
  const [pinB, setPinB] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pinA.length < 4 || pinA !== pinB) {
      toast.error(t('toastPinMismatch'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/banano/pin/reset-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: pinA }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : t('errResetFailed'));
      }
      toast.success(t('toastSuccess'));
      setPinA('');
      setPinB('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <Logo size="lg" />
        </div>
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-2">
            {t('titleInvalidLink')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
            {t('bodyInvalidLink')}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-[#2563eb] text-white font-semibold text-sm px-5 py-2.5 hover:brightness-110"
          >
            {t('linkLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-1">
          {t('titleNewPin')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
          {t.rich('bodyNewPinRich', {
            strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
          })}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="banano-reset-pin-a" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelNewCode')}
            </label>
            <input
              id="banano-reset-pin-a"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d*"
              maxLength={8}
              value={pinA}
              onChange={(e) => setPinA(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
              placeholder="••••"
              required
            />
          </div>
          <div>
            <label htmlFor="banano-reset-pin-b" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {t('labelConfirm')}
            </label>
            <input
              id="banano-reset-pin-b"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d*"
              maxLength={8}
              value={pinB}
              onChange={(e) => setPinB(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
              placeholder="••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || pinA.length < 4 || pinA !== pinB}
            className="w-full py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('btnSubmit')}
          </button>
        </form>
        <p className="mt-6 text-xs text-slate-500 dark:text-zinc-500 text-center">
          <Link href="/dashboard/settings" className="text-[#2563eb] hover:underline">
            {t('linkBackSettings')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function BananoPinResetPage() {
  return (
    <Suspense fallback={<BrandLoadingOverlay active />}>
      <BananoPinResetForm />
    </Suspense>
  );
}
