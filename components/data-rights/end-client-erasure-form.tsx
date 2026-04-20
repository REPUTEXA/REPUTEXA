'use client';

import { useState, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { AuthTurnstile } from '@/components/auth/turnstile';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { Loader2 } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { getPrivacyLocaleFromPhone } from '@/lib/privacy-locale-from-phone';
import { getRegionCodeForSiteLocale } from '@/lib/i18n/locale-region';

type AppLocale = (typeof routing.locales)[number];

const ERASURE_PHONE_NUMBER_INPUT_PROPS = {
  autoComplete: 'tel' as const,
  name: 'phone' as const,
  required: true as const,
};

const API_ERROR_TO_I18N: Record<string, 'errorRateLimit' | 'errorPhoneRequired' | 'errorTurnstileRequired' | 'errorTurnstileFailed' | 'errorInvalidPhone' | 'errorServiceUnavailable' | 'errorServer'> = {
  RATE_LIMIT: 'errorRateLimit',
  PHONE_REQUIRED: 'errorPhoneRequired',
  TURNSTILE_REQUIRED: 'errorTurnstileRequired',
  TURNSTILE_FAILED: 'errorTurnstileFailed',
  INVALID_PHONE: 'errorInvalidPhone',
  SERVICE_UNAVAILABLE: 'errorServiceUnavailable',
  SERVER: 'errorServer',
};

export function EndClientErasureForm() {
  const t = useTranslations('Legal.dataRightsClient');
  const locale = useLocale();
  const [phone, setPhone] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const defaultCountry = useMemo(() => getRegionCodeForSiteLocale(locale), [locale]);

  const legalLocale = useMemo((): AppLocale => {
    const loc = getPrivacyLocaleFromPhone(phone, locale);
    return (routing.locales as readonly string[]).includes(loc) ? (loc as AppLocale) : (locale as AppLocale);
  }, [phone, locale]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setFeedback({ ok: false, text: t('turnstileRequired') });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/public/client-data-erasure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': locale },
        body: JSON.stringify({
          phone,
          turnstileToken: turnstileToken ?? '',
          defaultCountry,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!res.ok) {
        const key = typeof data.error === 'string' ? API_ERROR_TO_I18N[data.error] : undefined;
        setFeedback({ ok: false, text: key ? t(key) : t('errorGeneric') });
      } else {
        setFeedback({ ok: true, text: t('success') });
        setPhone('');
        setTurnstileToken(null);
      }
    } catch {
      setFeedback({ ok: false, text: t('errorGeneric') });
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 text-left backdrop-blur-sm"
    >
      <p className="text-sm text-gray-300 leading-relaxed mb-6">{t('formIntro')}</p>

      <span className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        {t('phoneLabel')}
      </span>
      <PhoneInput
        id="erasure-phone"
        value={phone}
        onChange={(v) => setPhone(v ?? '')}
        defaultCountry={defaultCountry}
        placeholder={t('phonePlaceholder')}
        containerClassName="w-full"
        surface="onDark"
        numberInputProps={ERASURE_PHONE_NUMBER_INPUT_PROPS}
      />
      <p className="text-xs text-gray-500 mt-2">{t('phoneHint')}</p>

      <div className="mt-6">
        <AuthTurnstile
          action="client_data_erasure"
          onVerify={(tok) => setTurnstileToken(tok)}
          onExpire={() => setTurnstileToken(null)}
        />
      </div>

      {feedback && (
        <p
          className={`mt-4 text-sm rounded-lg px-3 py-2 ${
            feedback.ok
              ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
              : 'bg-red-500/15 text-red-200 border border-red-500/20'
          }`}
          role="status"
        >
          {feedback.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !phone.trim() || !isValidPhoneNumber(phone)}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? t('submitting') : t('submit')}
      </button>

      <p className="text-xs text-gray-500 mt-4 leading-relaxed">{t('footnote')}</p>

      <div className="mt-6 pt-6 border-t border-white/10 text-center space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">{t('privacyLinkLocaleHint')}</p>
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link
            href="/legal/confidentialite"
            locale={legalLocale}
            className="text-sm font-medium text-[#2563eb] hover:underline underline-offset-2"
          >
            {t('privacyLink')}
          </Link>
          <span className="hidden sm:inline text-gray-600" aria-hidden>
            ·
          </span>
          <Link
            href="/data-rights/client"
            locale={legalLocale}
            className="text-sm font-medium text-[#2563eb] hover:underline underline-offset-2"
          >
            {t('dataRightsSameFormLink')}
          </Link>
        </div>
      </div>
    </form>
  );
}
