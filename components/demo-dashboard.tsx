'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Sparkles, Smartphone, Shield, CheckCircle2 } from 'lucide-react';
import {
  getDemoExampleFromPreset,
  type DemoReviewPresetParam,
} from '@/lib/landing/demo-dashboard-data';
import { getStaticDemoReplyOptions } from '@/lib/landing/demo-dashboard-static-replies';

const TYPEWRITER_MS = 11;
const NOTIFICATION_DELAY_MS = 1800;

const DEMO_MODAL_SPRING_TRANSITION = { type: 'spring' as const, damping: 28, stiffness: 320 };
const DEMO_ZENITH_BANNER_SPRING = { type: 'spring' as const, stiffness: 380, damping: 28 };
const DEMO_OPTION_SHIMMER_TRANSITION = { duration: 2.2, repeat: Infinity, ease: 'linear' as const };

type DemoOption = {
  text: string;
  engine: 'anthropic' | 'openai';
  styleKey: string;
};

type WaScenario = 'approve' | 'revise';

type ApiPayload = {
  ok: true;
  source: 'live' | 'static' | 'rate_limited' | 'error';
  reviewPreset?: DemoReviewPresetParam;
  resolvedReviewTone?: 'positive' | 'negative' | 'hateful';
  business: string;
  reviewer: string;
  review: string;
  rating: number;
  phone?: string;
  email?: string;
  options: DemoOption[];
 selectedIndex: number;
  judgeEngine: 'anthropic' | 'openai' | null;
  enginesUsed: string[];
  primaryEngine: 'anthropic' | 'openai' | null;
  revisedShorter: string | null;
};

function naiveShortenLocal(text: string, locale: string): string {
  const t = text.trim();
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 2).join(' ');
  const max = locale === 'fr' ? 220 : 200;
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(' ', max);
  return (cut > 40 ? t.slice(0, cut) : t.slice(0, max)) + '…';
}

function playNotificationSound() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 820;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.14);
  } catch {
    // ignore
  }
}

function reviewerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0] ?? '';
    const b = parts[parts.length - 1]![0] ?? '';
    return (a + b).toUpperCase() || '•';
  }
  return name.slice(0, 2).toUpperCase() || '•';
}

function formatWaPhone(locale: string, raw?: string): string {
  if (!raw?.trim()) return locale === 'fr' ? '+33 · · · · · · · ·' : '+1 · · · · · · · ·';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10 && locale === 'fr') {
    const fr = digits.startsWith('33') ? digits.slice(2) : digits;
    const a = fr.slice(-9);
    return `+33 ${a.slice(0, 1)} ${a.slice(1, 3)} ${a.slice(3, 5)} ${a.slice(5, 7)} ${a.slice(7, 9)}`.trim();
  }
  return raw;
}

const PRESET_KEYS: DemoReviewPresetParam[] = [
  'positive',
  'negative',
  'hateful',
  'random',
];

export function DemoDashboard({ onClose }: { onClose: () => void }) {
  const t = useTranslations('HomePage.demo');
  const locale = useLocale();

  const [reviewPreset, setReviewPreset] = useState<DemoReviewPresetParam>('random');
  const [randomSeed, setRandomSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [waScenario, setWaScenario] = useState<WaScenario>('approve');
  const [waStage, setWaStage] = useState(0);

  const [displayText, setDisplayText] = useState('');
  const [streamPhase, setStreamPhase] = useState<'idle' | 'typing' | 'done'>('idle');
  const [streamSlot, setStreamSlot] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>([false, false, false]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const typewriterTimer = useRef<number | null>(null);

  const { example: localExample, resolvedTone: localResolvedTone } = useMemo(
    () =>
      getDemoExampleFromPreset(
        locale,
        reviewPreset,
        reviewPreset === 'random' ? randomSeed : undefined
      ),
    [locale, reviewPreset, randomSeed]
  );

  const review = localExample.review;
  const reviewer = localExample.reviewer;
  const business = localExample.business;

  const contactSentence = useMemo(() => {
    const phone = payload?.phone ?? localExample.phone;
    const email = payload?.email ?? localExample.email;
    if (phone) {
      return t('contactSentencePhone', { phone });
    }
    if (email) {
      return t('contactSentenceEmail', { email });
    }
    return '';
  }, [payload?.phone, payload?.email, localExample.phone, localExample.email, t]);

  const localFallbackOptions: DemoOption[] = useMemo(
    () => getStaticDemoReplyOptions(localExample, locale),
    [localExample, locale]
  );

  const options: DemoOption[] = useMemo(() => {
    if (payload?.options?.length === 3) return payload.options;
    return localFallbackOptions;
  }, [payload?.options, localFallbackOptions]);

  const engineLabel = useCallback(
    (e: DemoOption['engine']) => (e === 'anthropic' ? t('engineAnthropic') : t('engineOpenAI')),
    [t]
  );

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const res = await fetch('/api/public/review-reply-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale,
            reviewPreset,
            randomSeed,
          }),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as ApiPayload | { ok: false };
        if (!data || (data as { ok?: boolean }).ok !== true) throw new Error('bad payload');
        setPayload(data as ApiPayload);
      } catch {
        if (!ac.signal.aborted) setFetchError(true);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [locale, reviewPreset, randomSeed]);

  useEffect(() => {
    if (!loading) return;
    setStreamPhase('idle');
    setStreamSlot(0);
    setRevealed([false, false, false]);
    setSelectedIndex(null);
    setDisplayText('');
    setWaStage(0);
  }, [loading]);

  useEffect(() => {
    if (loading || streamPhase !== 'idle') return;
    setStreamPhase('typing');
    setStreamSlot(0);
    setRevealed([false, false, false]);
    setSelectedIndex(null);
    setDisplayText('');
    setWaStage(0);
  }, [loading, streamPhase]);

  useEffect(() => {
    if (streamPhase !== 'typing') return;
    const text = options[streamSlot]?.text ?? '';
    if (!text) return;

    let i = 0;
    setDisplayText('');
    if (typewriterTimer.current !== null) {
      window.clearInterval(typewriterTimer.current);
    }
    const adaptive = text.length > 380 ? 7 : TYPEWRITER_MS;
    const id = window.setInterval(() => {
      i += 1;
      setDisplayText(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setRevealed((prev) => {
          const n = [...prev];
          n[streamSlot] = true;
          return n;
        });
        if (streamSlot < 2) {
          setStreamSlot((s) => s + 1);
        } else {
          const sel =
            payload?.selectedIndex !== undefined &&
            payload.selectedIndex >= 0 &&
            payload.selectedIndex < 3
              ? payload.selectedIndex
              : contactSentence
                ? 2
                : 1;
          setSelectedIndex(sel);
          setStreamPhase('done');
        }
      }
    }, adaptive);
    typewriterTimer.current = id;
    return () => window.clearInterval(id);
  }, [streamPhase, streamSlot, options, payload?.selectedIndex, contactSentence]);

  const selectedReply =
    selectedIndex !== null && options[selectedIndex]?.text ? options[selectedIndex]!.text : '';

  const shorterFollowUp = useMemo(() => {
    if (payload?.revisedShorter?.trim()) return payload.revisedShorter.trim();
    if (selectedReply) return naiveShortenLocal(selectedReply, locale);
    return '';
  }, [payload?.revisedShorter, selectedReply, locale]);

  useEffect(() => {
    if (streamPhase !== 'done' || selectedIndex === null) {
      setWaStage(0);
      return undefined;
    }
    setWaStage(0);
    const t1 = window.setTimeout(() => setWaStage(1), 500);
    const t2 = window.setTimeout(() => setWaStage(2), 1900);
    const t3 =
      waScenario === 'revise'
        ? window.setTimeout(() => setWaStage(3), 3600)
        : undefined;
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (t3 !== undefined) window.clearTimeout(t3);
    };
  }, [streamPhase, selectedIndex, waScenario]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const [zenithVisible, setZenithVisible] = useState(false);
  useEffect(() => {
    setZenithVisible(false);
  }, [reviewPreset, randomSeed]);
  useEffect(() => {
    if (loading) return;
    const timeout = window.setTimeout(() => {
      setZenithVisible(true);
      playNotificationSound();
    }, NOTIFICATION_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [reviewPreset, randomSeed, loading]);

  const ribbonText = loading
    ? t('fetchingReplies')
    : payload?.source === 'rate_limited'
      ? t('rateLimitHint')
      : payload?.source === 'error' || fetchError
        ? t('errorHint')
        : payload?.source === 'static' || !payload?.primaryEngine
          ? t('staticHint')
          : payload.primaryEngine === 'anthropic'
            ? t('singleEngineRibbon', { engine: t('engineAnthropic') })
            : t('singleEngineRibbon', { engine: t('engineOpenAI') });

  const rating = payload?.rating ?? localExample.rating;
  const waPhone = formatWaPhone(locale, payload?.phone ?? localExample.phone);
  const effectiveTone =
    payload?.resolvedReviewTone ?? localResolvedTone;
  const flowShield = effectiveTone === 'hateful';
  const flowPositive = effectiveTone === 'positive';

  const shieldAlertText = useMemo(() => {
    const r = (payload?.review ?? review).trim();
    const excerpt = r.length > 160 ? `${r.slice(0, 157)}…` : r;
    return t('shieldWaAlertBody', {
      reviewer: payload?.reviewer ?? reviewer,
      business: payload?.business ?? business,
      excerpt,
    });
  }, [payload?.review, payload?.reviewer, payload?.business, review, reviewer, business, t]);

  const zenithBannerText =
    effectiveTone === 'positive'
      ? t('zenithAlertPositive')
      : effectiveTone === 'hateful'
        ? t('zenithAlertHateful')
        : t('zenithAlertNegative');
  const randomToneLabel =
    effectiveTone === 'positive'
      ? t('reviewPresetToneLabels.positive')
      : effectiveTone === 'hateful'
        ? t('reviewPresetToneLabels.hateful')
        : t('reviewPresetToneLabels.negative');

  const arbiterText = flowShield
    ? payload?.judgeEngine === 'anthropic'
      ? t('arbiterShieldLine', { engine: t('engineAnthropic') })
      : payload?.judgeEngine === 'openai'
        ? t('arbiterShieldLine', { engine: t('engineOpenAI') })
        : streamPhase === 'done' && payload?.source === 'live'
          ? t('arbiterShieldHeuristic')
          : null
    : payload?.judgeEngine === 'anthropic'
      ? t('arbiterLine', { engine: t('engineAnthropic') })
      : payload?.judgeEngine === 'openai'
        ? t('arbiterLine', { engine: t('engineOpenAI') })
        : streamPhase === 'done' && payload?.source === 'live'
          ? t('arbiterHeuristic')
          : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
        <motion.div
          className="absolute inset-0 bg-slate-950/88 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden
        />
        <motion.div
          role="dialog"
          aria-modal
          aria-labelledby="demo-dashboard-title"
          className="relative flex max-h-[min(92vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
          style={{
            background:
              'linear-gradient(155deg, rgba(15, 23, 42, 0.96) 0%, rgba(7, 10, 16, 0.99) 50%, rgba(17, 24, 39, 0.94) 100%)',
            boxShadow:
              '0 0 120px -35px rgba(59, 130, 246, 0.38), 0 0 70px -25px rgba(16, 185, 129, 0.18), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.99 }}
          transition={DEMO_MODAL_SPRING_TRANSITION}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 0%, #3b82f6 0%, transparent 42%), radial-gradient(circle at 92% 8%, #10b981 0%, transparent 28%)',
            }}
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-30 rounded-xl border border-white/15 bg-slate-900/80 p-2.5 text-white/80 backdrop-blur-md transition-colors hover:bg-slate-800 hover:text-white sm:right-4 sm:top-4"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-8 pt-14 sm:px-8 sm:pt-16">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:pr-12">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-blue-500/25">
                    <span className="font-display text-lg font-bold text-white">R</span>
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="demo-dashboard-title"
                      className="font-display text-lg font-bold tracking-tight text-white sm:text-xl"
                    >
                      {t('dashboardTitle')}
                    </h2>
                    <p className="truncate text-xs text-slate-400 sm:text-sm">{payload?.business ?? business}</p>
                  </div>
                </div>
              </div>

              <div className="mb-5 space-y-2">
                <p id="demo-review-preset-label" className="text-[11px] font-medium text-slate-500">
                  {t('reviewPresetLabel')}
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-labelledby="demo-review-preset-label"
                >
                  {PRESET_KEYS.map((key) => {
                    const active = reviewPreset === key;
                    const label =
                      key === 'positive'
                        ? t('reviewPresetPositive')
                        : key === 'negative'
                          ? t('reviewPresetNegative')
                          : key === 'hateful'
                            ? t('reviewPresetHateful')
                            : t('reviewPresetRandom');
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setLoading(true);
                          setFetchError(false);
                          setReviewPreset(key);
                          setRandomSeed(Math.floor(Math.random() * 1e9));
                          setPayload(null);
                        }}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? 'border-sky-400/55 bg-sky-500/20 text-sky-50 shadow-[0_0_20px_-8px_rgba(56,189,248,0.65)]'
                            : 'border-white/12 bg-white/[0.04] text-slate-400 hover:border-white/22 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {reviewPreset === 'random' && !loading && (
                  <p className="text-[10px] text-slate-500">
                    {t('reviewPresetRandomBadge', { tone: randomToneLabel })}
                  </p>
                )}
              </div>

              {zenithVisible && (
                <motion.div
                  className="mb-5 w-full rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 shadow-inner backdrop-blur-sm"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={DEMO_ZENITH_BANNER_SPRING}
                >
                  <span className="mr-2" aria-hidden>
                    💬
                  </span>
                  {zenithBannerText}
                </motion.div>
              )}

              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium leading-snug text-slate-200 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
                  <span className="min-w-0 break-words">{ribbonText}</span>
                </div>
                {arbiterText && streamPhase === 'done' && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-100">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-400" aria-hidden />
                    {arbiterText}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
                {/* Colonne gauche — contexte avis + flux IA */}
                <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
                  <motion.div
                    className="rounded-2xl border border-white/12 bg-slate-900/40 p-4 shadow-inner backdrop-blur-xl sm:p-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/35 to-violet-600/25 text-sm font-semibold text-fuchsia-50 ring-2 ring-white/10">
                        {reviewerInitials(payload?.reviewer ?? reviewer)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2 gap-y-1">
                          <span className="font-semibold text-white">{payload?.reviewer ?? reviewer}</span>
                          <div className="flex shrink-0 gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <svg
                                key={s}
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill={s <= rating ? '#FBBF24' : 'none'}
                                stroke="#FBBF24"
                                strokeWidth="2"
                                className="shrink-0"
                                aria-hidden
                              >
                                <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                        <p className="mb-2 text-xs font-medium text-slate-400">{payload?.business ?? business}</p>
                        <p className="text-sm italic leading-relaxed text-slate-100">
                          &ldquo;{payload?.review ?? review}&rdquo;
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/20 via-indigo-500/12 to-violet-600/15 p-4 shadow-[0_0_48px_-14px_rgba(56,189,248,0.45)] backdrop-blur-xl sm:p-5">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-400/25 blur-3xl" />
                    <div className="relative">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Zap className="h-4 w-4 shrink-0 text-sky-200" aria-hidden />
                        {loading ? (
                          <span className="text-sm font-semibold text-sky-100">{t('fetchingReplies')}</span>
                        ) : (
                          <span className="text-sm font-semibold text-sky-50">
                            {flowShield
                              ? t('generatingShieldVariant', {
                                  current: streamPhase === 'done' ? 3 : streamSlot + 1,
                                  engine: engineLabel(options[streamSlot]?.engine ?? 'openai'),
                                })
                              : t('generatingVoice', {
                                  current: streamPhase === 'done' ? 3 : streamSlot + 1,
                                  engine: engineLabel(options[streamSlot]?.engine ?? 'openai'),
                                })}
                          </span>
                        )}
                      </div>
                      {loading ? (
                        <div className="space-y-2.5 py-1">
                          <div className="h-3 w-full animate-pulse rounded-md bg-white/15" />
                          <div className="h-3 w-[88%] animate-pulse rounded-md bg-white/12" />
                          <div className="h-3 w-[72%] animate-pulse rounded-md bg-white/10" />
                        </div>
                      ) : (
                        <p className="min-h-[6rem] text-[15px] leading-[1.65] text-slate-50">
                          {displayText}
                          {streamPhase === 'typing' && (
                            <span
                              className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-sky-200 align-middle"
                              aria-hidden
                            />
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Colonne centre — variantes */}
                <div className="flex min-w-0 flex-col gap-3 lg:col-span-4">
                  <p className="text-xs leading-relaxed text-slate-400">
                    {flowShield ? t('shieldWaHint') : flowPositive ? t('positiveWaHint') : t('waHint')}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-400/90">
                    {flowShield
                      ? t('shieldColumnSubtitle')
                      : flowPositive
                        ? t('positiveColumnSubtitle')
                        : t('multiModelSubtitle')}
                  </p>

                  {[0, 1, 2].map((idx) => {
                    const opt = options[idx]!;
                    const isDone = revealed[idx];
                    const isSelected = selectedIndex === idx && streamPhase === 'done';

                    return (
                      <motion.div
                        key={idx}
                        layout
                        className={`relative overflow-hidden rounded-2xl border px-3.5 py-3 text-xs leading-relaxed backdrop-blur-md transition-colors sm:px-4 sm:py-3.5 ${
                          isSelected
                            ? 'border-emerald-400/55 bg-emerald-500/[0.14] text-emerald-50 shadow-[0_0_36px_-10px_rgba(52,211,153,0.4)]'
                            : isDone
                              ? 'border-white/14 bg-white/[0.06] text-slate-200'
                              : 'border-white/10 bg-white/[0.03] text-slate-500'
                        }`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 + idx * 0.04 }}
                      >
                        {!isDone && (
                          <motion.div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-70"
                            initial={{ x: '-100%' }}
                            animate={{ x: '200%' }}
                            transition={DEMO_OPTION_SHIMMER_TRANSITION}
                          />
                        )}
                        <div className="relative mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-100">
                            {flowShield ? t('shieldProposalLabel', { n: idx + 1 }) : `Option ${idx + 1}`}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                opt.engine === 'anthropic'
                                  ? 'bg-amber-500/25 text-amber-50 ring-1 ring-amber-400/35'
                                  : 'bg-emerald-500/25 text-emerald-50 ring-1 ring-emerald-400/30'
                              }`}
                            >
                              {engineLabel(opt.engine)}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
                                {flowPositive ? t('positiveSelectedBadge') : t('selectedByReputexa')}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isDone ? (
                          <div className="relative flex items-center justify-between gap-2 text-slate-500">
                            <span>{t('optionWorking', { n: idx + 1 })}</span>
                            <span className="flex gap-1" aria-hidden>
                              <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400/90 [animation-delay:0ms]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400/90 [animation-delay:150ms]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400/90 [animation-delay:300ms]" />
                            </span>
                          </div>
                        ) : (
                          <p className="relative text-[13px] leading-relaxed text-slate-100/95">{opt.text}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Colonne droite — téléphone (ou panneau sans validation si avis positif) */}
                <div className="flex min-w-0 flex-col lg:col-span-3">
                  <div className="mb-2 flex items-center gap-2 text-slate-300">
                    {flowShield ? (
                      <Shield className="h-4 w-4 shrink-0 text-red-400/95" aria-hidden />
                    ) : flowPositive ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400/95" aria-hidden />
                    ) : (
                      <Smartphone className="h-4 w-4 shrink-0 text-emerald-400/90" aria-hidden />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {flowShield
                        ? t('shieldWaPreviewTitle')
                        : flowPositive
                          ? t('positiveNoValidationTitle')
                          : t('waPreviewTitle')}
                    </span>
                  </div>

                  {flowPositive ? (
                    <div className="mx-auto w-full max-w-[280px] rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.08] p-4 shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)] backdrop-blur-md">
                      <p className="text-[13px] leading-relaxed text-emerald-50/95">{t('positiveNoValidationBody')}</p>
                      {streamPhase === 'done' && !loading && (
                        <p className="mt-4 border-t border-emerald-500/25 pt-3 text-center text-[11px] font-semibold text-emerald-300">
                          {t('positiveReadyGoogle')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWaScenario('approve')}
                      className={`flex-1 rounded-xl border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-xs ${
                        waScenario === 'approve'
                          ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      {flowShield ? t('shieldOwnerApprove') : t('waScenarioApprove')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaScenario('revise')}
                      className={`flex-1 rounded-xl border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-xs ${
                        waScenario === 'revise'
                          ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      {flowShield ? t('shieldOwnerRevise') : t('waScenarioRevise')}
                    </button>
                  </div>

                  <div className="mx-auto w-full max-w-[280px] rounded-[1.85rem] border border-slate-600/40 bg-gradient-to-b from-slate-800/80 to-slate-950/90 p-2 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/10">
                    <div className="overflow-hidden rounded-[1.4rem] bg-[#0b141a]">
                      <div className="flex items-center gap-2.5 border-b border-white/8 bg-[#202c33] px-3 py-2.5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ring-2 ring-white/10 ${
                            flowShield ? 'bg-red-600/95' : 'bg-emerald-600'
                          }`}
                          aria-hidden
                        >
                          {flowShield ? (
                            <Shield className="h-4 w-4" strokeWidth={2.2} />
                          ) : (
                            <span className="text-xs font-bold">
                              {reviewerInitials(payload?.reviewer ?? reviewer).slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white/95">
                            {flowShield ? t('shieldWaFrom') : payload?.reviewer ?? reviewer}
                          </p>
                          <p className="truncate text-[10px] text-emerald-400/95">{waPhone}</p>
                        </div>
                      </div>

                      <div className="flex min-h-[300px] flex-col gap-2.5 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23182229%22%20fill-opacity%3D%220.35%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] bg-[length:60px_60px] px-2.5 py-3">
                        <AnimatePresence mode="popLayout">
                          {waStage >= 1 && (flowShield ? shieldAlertText : selectedReply) && (
                            <motion.div
                              key="biz1"
                              initial={{ opacity: 0, y: 8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className="ml-4 self-end"
                            >
                              <p className="mb-0.5 text-right text-[9px] font-medium uppercase tracking-wide text-emerald-400/80">
                                {flowShield ? t('shieldWaFrom') : t('waBizCaption')}
                              </p>
                              <div className="max-h-36 max-w-[95%] overflow-y-auto rounded-2xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-left text-[11px] leading-snug text-white shadow-md">
                                {flowShield ? shieldAlertText : selectedReply}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence mode="popLayout">
                          {waStage >= 2 && (
                            <motion.div
                              key="cust"
                              initial={{ opacity: 0, y: 8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className="mr-2 self-start"
                            >
                              <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-[11px] leading-snug text-slate-100 shadow-md ring-1 ring-white/5">
                                {flowShield
                                  ? waScenario === 'approve'
                                    ? t('shieldOwnerApprove')
                                    : t('shieldOwnerRevise')
                                  : waScenario === 'approve'
                                    ? t('waCustomerApprove')
                                    : t('waCustomerRevise')}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence mode="popLayout">
                          {waScenario === 'revise' && waStage >= 3 && shorterFollowUp && (
                            <motion.div
                              key="biz2"
                              initial={{ opacity: 0, y: 8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className="ml-4 self-end"
                            >
                              <p className="mb-0.5 text-right text-[9px] font-medium uppercase tracking-wide text-emerald-400/80">
                                {flowShield ? t('shieldShorterCaption') : t('waBizReviseCaption')}
                              </p>
                              <div className="max-h-32 max-w-[95%] overflow-y-auto rounded-2xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-left text-[11px] leading-snug text-white shadow-md">
                                {shorterFollowUp}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {streamPhase === 'done' && waStage === 0 && (
                          <div className="mt-auto flex justify-center gap-1 pb-2 pt-4 opacity-60">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:120ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:240ms]" />
                          </div>
                        )}

                        {streamPhase === 'done' &&
                          waStage >= 2 &&
                          (waScenario === 'approve' || (waScenario === 'revise' && waStage >= 3)) && (
                            <p className="mt-auto border-t border-white/5 pt-2 text-center text-[10px] font-medium text-emerald-400/90">
                              {flowShield ? t('shieldReadySubmit') : t('waReadyGoogle')}
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
