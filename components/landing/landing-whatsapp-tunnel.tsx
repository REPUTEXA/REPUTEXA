'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { RefreshCw, Star } from 'lucide-react';
import type {
  TunnelDemoMessage,
  TunnelDemoPayload,
  TunnelGoogleScene,
  TunnelScenarioPath,
} from '@/types/whatsapp-tunnel-demo';

const KIND_OPTIONS: { id: 'random' | TunnelScenarioPath; labelKey: string }[] = [
  { id: 'random', labelKey: 'chipRandom' },
  { id: 'happy_full', labelKey: 'chipHappyFull' },
  { id: 'decline_first', labelKey: 'chipDeclineFirst' },
  { id: 'happy_with_edit', labelKey: 'chipHappyWithEdit' },
  { id: 'stop_after_yes', labelKey: 'chipStopAfterYes' },
];

const SCENARIO_LABEL_KEY: Record<TunnelScenarioPath, string> = {
  decline_first: 'scenario_decline_first',
  happy_full: 'scenario_happy_full',
  happy_with_edit: 'scenario_happy_with_edit',
  stop_after_yes: 'scenario_stop_after_yes',
};

function demoLocaleFromUi(locale: string): string {
  const raw = locale.toLowerCase();
  const primary = raw.split(/[-_]/)[0] ?? raw;
  if (primary === 'fr') return 'fr';
  if (primary === 'it') return 'it';
  if (primary === 'es') return 'es';
  if (primary === 'de') return 'de';
  if (primary === 'zh') return 'zh';
  if (primary === 'ja') return 'ja';
  if (primary === 'pt') return 'pt';
  if (raw === 'en-gb' || primary === 'en') return 'en';
  return 'en';
}

function WhatsAppFrame({
  establishmentName,
  messages,
  onlineLabel,
  ariaLabel,
}: {
  establishmentName: string;
  messages: TunnelDemoMessage[];
  onlineLabel: string;
  ariaLabel: string;
}) {
  return (
    <div
      className="w-full max-w-xl mx-auto rounded-[2rem] overflow-hidden border border-white/20 bg-[#0b141a] shadow-2xl shadow-black/40"
      aria-label={ariaLabel}
    >
      <div className="bg-[#075E54] text-white px-3 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
          {establishmentName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{establishmentName}</p>
          <p className="text-[11px] text-emerald-100/90">{onlineLabel}</p>
        </div>
      </div>
      <div
        className="min-h-[320px] sm:min-h-[380px] max-h-[440px] overflow-y-auto px-2 py-3 space-y-2"
        style={{
          backgroundColor: '#ECE5DD',
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,.015) 10px, rgba(0,0,0,.015) 20px)',
        }}
      >
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.text.slice(0, 12)}`}
            className={`flex ${m.from === 'client' ? 'justify-end' : 'justify-start'} animate-fade-up`}
            style={{ animationDelay: `${Math.min(i * 0.05, 0.6)}s`, opacity: 0 }}
          >
            <div
              className={`max-w-[88%] rounded-lg px-2.5 py-2 text-[15px] leading-snug shadow-sm ${
                m.from === 'client'
                  ? 'bg-[#DCF8C6] text-gray-900 rounded-br-none'
                  : 'bg-white text-gray-900 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              <p className="text-[11px] text-gray-400 text-right mt-0.5 tabular-nums">
                {String(10 + (i % 50)).padStart(2, '0')}:{String((i * 7) % 60).padStart(2, '0')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleReviewFrame({
  establishmentName,
  scene,
  ariaLabel,
}: {
  establishmentName: string;
  scene: TunnelGoogleScene;
  ariaLabel: string;
}) {
  const t = useTranslations('HomePage.tunnel');
  return (
    <div
      className="w-full max-w-xl mx-auto rounded-[2rem] overflow-hidden border border-white/20 bg-white shadow-2xl shadow-black/25"
      aria-label={ariaLabel}
    >
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4285F4]/10 text-[#4285F4] font-bold text-sm">
          G
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{establishmentName}</p>
          <p className="text-[11px] text-slate-500">{t('googleMapsHint')}</p>
        </div>
      </div>
      <div className="bg-slate-50 px-4 py-4 space-y-5">
        <div>
          <div className="flex items-center gap-1 mb-1" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            {t('googleReviewSnippetLabel')}
          </p>
          <p className="text-sm text-slate-800 leading-snug whitespace-pre-wrap">{scene.reviewSnippet}</p>
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-[11px] font-semibold text-slate-600 mb-2">{t('googleBusinessReplySectionTitle')}</p>
          <p className="text-[11px] text-slate-400 mb-2">
            {t('googleDelayPrefix')} · <span className="text-slate-600">{scene.replyDelayHint}</span>
          </p>
          <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-800 leading-snug shadow-sm">
            {scene.businessReply}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingWhatsappTunnel() {
  const t = useTranslations('HomePage.tunnel');
  const uiLocale = useLocale();
  const apiLocale = demoLocaleFromUi(uiLocale);

  const [data, setData] = useState<TunnelDemoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [kind, setKind] = useState<'random' | TunnelScenarioPath>('random');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(false);
    const ctrl = new AbortController();
    let abortTimer: ReturnType<typeof setTimeout> | null = null;
    if (typeof window !== 'undefined') {
      abortTimer = setTimeout(() => ctrl.abort(), 28_000);
    }
    try {
      const kindParam = kind === 'random' ? '' : `&kind=${encodeURIComponent(kind)}`;
      const res = await fetch(
        `/api/public/whatsapp-tunnel-demo?locale=${encodeURIComponent(apiLocale)}${kindParam}`,
        { method: 'GET', cache: 'no-store', signal: ctrl.signal }
      );
      if (!res.ok) throw new Error('bad status');
      let json: TunnelDemoPayload;
      try {
        json = (await res.json()) as TunnelDemoPayload;
      } catch {
        throw new Error('bad json');
      }
      if (!json.messages?.length) throw new Error('empty');
      setData(json);
    } catch {
      setErr(true);
      setData(null);
    } finally {
      if (abortTimer != null) clearTimeout(abortTimer);
      setLoading(false);
    }
  }, [apiLocale, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const enginesLabel =
    data?.enginesUsed?.length === 2
      ? t('demoEnginesDual')
      : data?.enginesUsed?.length === 1
        ? data.enginesUsed[0] === 'anthropic'
          ? t('demoEnginesClaude')
          : t('demoEnginesOpenAI')
        : null;

  const scenarioName =
    data?.scenario != null ? t(SCENARIO_LABEL_KEY[data.scenario]) : null;

  return (
    <div className="lg:sticky lg:top-24">
      <div className="mb-2">
        <p className="text-[11px] text-white/45">{t('demoChipsHint')}</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {KIND_OPTIONS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            disabled={loading}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors border ${
              kind === id
                ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
            } disabled:opacity-50`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{t('demoTitle')}</p>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-white disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {t('demoRefresh')}
        </button>
      </div>

      {loading && !data && (
        <div className="rounded-[2rem] border border-white/15 bg-white/5 h-[360px] flex items-center justify-center text-white/50 text-sm">
          {t('demoLoading')}
        </div>
      )}

      {err && !data && !loading && (
        <div className="rounded-[2rem] border border-white/15 bg-white/5 p-6 text-center text-white/60 text-sm">
          {t('demoError')}
        </div>
      )}

      {data && (
        <>
          {scenarioName && (
            <p className="text-[11px] text-emerald-200/80 mb-2 text-center font-medium">
              {t('scenarioLine', { name: scenarioName })}
            </p>
          )}
          <div className="flex flex-col gap-8 w-full">
            <div className="w-full">
              <WhatsAppFrame
                establishmentName={data.establishmentName}
                messages={data.messages}
                onlineLabel={t('demoOnline')}
                ariaLabel={t('frameAriaLabel')}
              />
            </div>
            {data.googleScene ? (
              <div className="w-full space-y-3 pt-2 border-t border-white/10">
                <p className="text-center text-[12px] font-semibold uppercase tracking-wider text-white/55">
                  {t('googleFrameTitle')}
                </p>
                <GoogleReviewFrame
                  establishmentName={data.establishmentName}
                  scene={data.googleScene}
                  ariaLabel={t('googleFrameAria')}
                />
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/5 min-h-[200px] flex items-center justify-center px-6 w-full max-w-xl mx-auto">
                <p className="text-xs text-white/45 text-center leading-relaxed">{t('googleFrameUnavailable')}</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-white/35 mt-3 text-center leading-relaxed">
            {enginesLabel ? enginesLabel : t('demoStaticFallback')}
          </p>
        </>
      )}
    </div>
  );
}

export function LandingWhatsappTunnelCopy() {
  const t = useTranslations('HomePage.tunnel');
  const steps = ['1', '2', '3', '4', '5'] as const;

  return (
    <div className="text-left">
      <span className="inline-block bg-emerald-500/15 text-emerald-300 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-3">
        {t('badge')}
      </span>
      <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-heading mb-3">
        {t('title')}
      </h2>
      <p className="text-white/65 text-sm sm:text-base leading-relaxed mb-8">{t('subtitle')}</p>
      <ul className="space-y-5">
        {steps.map((key) => (
          <li key={key} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-emerald-300">
              {key}
            </span>
            <div>
              <h3 className="font-semibold text-white text-sm sm:text-base mb-1">{t(`steps.${key}.title`)}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{t(`steps.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-white/50 leading-relaxed mt-8 border-t border-white/10 pt-6">{t('operationalNote')}</p>
    </div>
  );
}
