'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

type Props = {
  token: string;
  locale: string;
  establishmentName: string;
  inviteeName: string;
};

export function JoinStaffForm({ token, locale, establishmentName, inviteeName }: Props) {
  const t = useTranslations('JoinStaff');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/join/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : t('errorGeneric'));
        return;
      }
      const email = typeof data.email === 'string' ? data.email : '';
      if (!email) {
        setError(t('errorGeneric'));
        return;
      }
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      router.replace('/staff');
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t('title')}</h1>
      <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6">
        {t('subtitle', { name: inviteeName, shop: establishmentName })}
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="pw" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
            {t('passwordLabel')}
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-slate-900 dark:text-zinc-100"
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl bg-primary text-white font-semibold disabled:opacity-60"
        >
          {loading ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  );
}
