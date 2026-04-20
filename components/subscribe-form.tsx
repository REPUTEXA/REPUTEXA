'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

function SuccessScreen() {
  const t = useTranslations('SubscribeForm');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/10 ring-1 ring-[#2563eb]/30">
        <CheckCircle2 className="h-5 w-5 text-[#2563eb]" />
      </div>
      <div className="text-center sm:text-left">
        <p className="font-semibold text-white text-sm">{t('successTitle')}</p>
        <p className="text-sm text-gray-400">{t('successBody')}</p>
      </div>
    </div>
  );
}

export function SubscribeForm() {
  const locale = useLocale();
  const t = useTranslations('SubscribeForm');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t('errorGeneric'));
        return;
      }
      setDone(true);
    } catch {
      setError(t('errorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-7 text-center">
      <h3 className="font-display font-bold text-white mb-2 text-lg">{t('title')}</h3>
      <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto leading-relaxed">{t('description')}</p>

      {done ? (
        <div className="flex justify-center py-2">
          <SuccessScreen />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t('placeholder')}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-colors text-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors disabled:opacity-60 disabled:pointer-events-none active:scale-[0.97]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {t('submit')}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-xs text-red-500 text-center">{error}</p>}

      <p className="mt-5 text-xs text-gray-600">{t('footerNote')}</p>
    </div>
  );
}
