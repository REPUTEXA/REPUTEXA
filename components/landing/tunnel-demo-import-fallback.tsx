'use client';

import { useTranslations } from 'next-intl';

/** Si le chunk `landing-whatsapp-tunnel` ne charge pas (réseau, HMR, etc.). */
export function TunnelInteractiveFallback() {
  const t = useTranslations('HomePage.tunnel');
  return (
    <div className="lg:sticky lg:top-24">
      <div className="rounded-[2rem] border border-white/15 bg-white/5 min-h-[360px] flex items-center justify-center px-6 text-center text-white/60 text-sm">
        {t('demoError')}
      </div>
    </div>
  );
}

export function TunnelCopyFallback() {
  const t = useTranslations('HomePage.tunnel');
  return (
    <div className="text-left">
      <p className="text-white/55 text-sm leading-relaxed">{t('demoError')}</p>
    </div>
  );
}
