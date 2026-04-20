'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { SITE_LOCALE_CODES } from '@/lib/i18n/site-locales-catalog';
import { PublicPageShell } from '@/components/public-page-shell';
import { BrandLoadingOverlay } from '@/components/brand/brand-page-loader';
import { CheckCircle2, XCircle, AlertTriangle, Mail, ArrowLeft, Loader2 } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type State = 'loading' | 'success' | 'error' | 'invalid';

/* ─── Main content (inside Suspense — useSearchParams requirement) ──────────── */
function UnsubscribeContent() {
  const pathLocale = useLocale();
  const tu = useTranslations('PublicPages.newsletterUnsubscribe');
  const searchParams = useSearchParams();
  const email = searchParams.get('email')?.trim().toLowerCase() ?? '';
  const qpLocaleRaw = searchParams.get('locale')?.toLowerCase().split('-')[0] ?? '';
  const localeForApi = SITE_LOCALE_CODES.includes(qpLocaleRaw as (typeof SITE_LOCALE_CODES)[number])
    ? qpLocaleRaw
    : pathLocale;
  const [state, setState] = useState<State>(email ? 'loading' : 'invalid');
  const called = useRef(false);

  useEffect(() => {
    if (!email || called.current) return;
    called.current = true;

    /* Auto-process unsubscription the moment the page loads — 1 clic suffit */
    fetch('/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locale: localeForApi }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        setState(json.success ? 'success' : 'error');
      })
      .catch(() => setState('error'));
  }, [email, localeForApi]);

  /* ── Shared card wrapper ── */
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-8 text-center shadow-[0_4px_40px_rgba(0,0,0,0.4)]">
          {children}
        </div>
        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {tu('backHome')}
          </Link>
        </div>
      </div>
    </div>
  );

  /* ── Loading ── */
  if (state === 'loading') {
    return (
      <Card>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2563eb]/10 ring-1 ring-[#2563eb]/20">
          <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{tu('loadingTitle')}</h1>
        <p className="text-sm text-gray-500">{tu('loadingBody')}</p>
      </Card>
    );
  }

  /* ── Invalid (no email param) ── */
  if (state === 'invalid') {
    return (
      <Card>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-3">{tu('invalidTitle')}</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">{tu('invalidBody')}</p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
        >
          {tu('contactSupport')}
        </Link>
      </Card>
    );
  }

  /* ── Error ── */
  if (state === 'error') {
    return (
      <Card>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-3">{tu('errorTitle')}</h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">{tu('errorBody')}</p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
        >
          {tu('contactSupport')}
        </Link>
      </Card>
    );
  }

  /* ── Success ── */
  return (
    <Card>
      {/* Animated checkmark */}
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">{tu('successTitle')}</h1>

      <p className="text-sm text-gray-400 leading-relaxed mb-2">{tu('successBody')}</p>

      {email && (
        <p className="text-xs text-gray-600 font-mono mb-4">{email}</p>
      )}

      {/* Confirmation email note */}
      <div className="mt-3 mb-6 flex items-start gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-left">
        <Mail className="w-4 h-4 text-[#2563eb] shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">{tu('successEmailNote')}</p>
      </div>

      <Link
        href="/blog"
        className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
      >
        {tu('successCtaBlog')}
      </Link>

      <p className="mt-5 text-xs text-gray-600">
        {tu('successResubscribePart1')}
        <Link href="/blog" className="text-[#2563eb] hover:underline underline-offset-2">
          {tu('successResubscribeLink')}
        </Link>
        {tu('successResubscribePart2')}
      </p>
    </Card>
  );
}

/* ─── Page export ──────────────────────────────────────────────────────────── */
export default function UnsubscribePage() {
  const t = useTranslations('PublicPages');
  return (
    <PublicPageShell title={t('newsletterUnsubscribe.title')} subtitle={t('newsletterUnsubscribe.subtitle')}>
      <Suspense fallback={<BrandLoadingOverlay active />}>
        <UnsubscribeContent />
      </Suspense>
    </PublicPageShell>
  );
}
