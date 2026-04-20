'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { isUkGeoCountry, readGeoCountryFromDocumentCookie } from '@/lib/i18n/reputexa-geo-country';

type BadgePayload = { ok?: boolean; certified?: boolean };

export function LandingEuComplianceBadge() {
  const tEu = useTranslations('HomePage.hero.euCompliance');
  const tUk = useTranslations('HomePage.hero.ukCompliance');
  const [certified, setCertified] = useState<boolean | null>(null);
  const [ukVisitor, setUkVisitor] = useState(false);

  const t = ukVisitor ? tUk : tEu;

  useEffect(() => {
    setUkVisitor(isUkGeoCountry(readGeoCountryFromDocumentCookie()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/compliance/trust-badge', { cache: 'no-store' })
      .then((r) => r.json() as Promise<BadgePayload>)
      .then((j) => {
        if (!cancelled) setCertified(j.certified === true);
      })
      .catch(() => {
        if (!cancelled) setCertified(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ok = certified === true;
  const pending = certified === null;

  return (
    <div className="mt-5 sm:mt-6 flex flex-col items-center gap-2 max-w-xl mx-auto animate-fade-up px-2 [animation-delay:150ms]">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
          ok
            ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.15)]'
            : pending
              ? 'border-white/20 bg-white/5 text-white/70'
              : 'border-amber-400/35 bg-amber-500/10 text-amber-100/90'
        }`}
      >
        <ShieldCheck className={`w-4 h-4 shrink-0 ${ok ? 'text-emerald-300' : pending ? 'text-white/50' : 'text-amber-200'}`} aria-hidden />
        <span>{t('badge')}</span>
      </div>
      <p className="text-xs text-white/55 text-center leading-relaxed">{t('subtitle')}</p>
      <p className="text-[10px] text-white/40 text-center leading-relaxed">{t('authorityLine')}</p>
      {pending && <p className="text-[10px] text-white/35">{t('pending')}</p>}
      {!pending && !ok && <p className="text-[10px] text-rose-200/90 text-center">{t('notOk')}</p>}
    </div>
  );
}
