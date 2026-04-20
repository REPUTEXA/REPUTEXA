'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { QrCode } from 'lucide-react';
import { passColorToHex } from '@/lib/banano/wallet-design-utils';
import type { WalletStampIconId } from '@/lib/wallet/presets';
import { STAMP_ICON_COMPONENTS } from '@/lib/wallet/stamp-icon-map';
import { WalletPassStripHero } from '@/components/banano/wallet-pass-strip-hero';
import type { NormalizedRect, WalletStripCrop } from '@/lib/wallet/wallet-strip-crop';

export type WalletPassPreviewProps = {
  logoText: string;
  memberName: string;
  balanceLabel: string;
  balanceValue: string;
  background: string | null;
  foreground: string | null;
  labelColor: string | null;
  logoUrl: string | null;
  stripUrl: string | null;
  customCss: string | null;
  stripCrop: WalletStripCrop;
  stripPreCrop: NormalizedRect | null;
  stampIconId: WalletStampIconId;
  balanceMode: 'stamps' | 'points';
  ambianceLine: string | null;
  pointsProgressTarget?: number;
};

type PreviewView = 'front' | 'back' | 'detail';

const DEFAULT_BG = '#0f172a';
const DEFAULT_FG = '#fef3c7';
const DEFAULT_LAB = '#94a3b8';

const CARD_MAX_W = 288;
const STRIP_ASPECT = '375 / 123';
const EASE = [0.4, 0, 0.2, 1] as const;
const DEFAULT_POINTS_TARGET = 500;
const DEMO_STAMPS_LEFT = 3;

export function WalletPassPreview({
  logoText,
  memberName,
  balanceLabel,
  balanceValue,
  background,
  foreground,
  labelColor,
  logoUrl,
  stripUrl,
  customCss,
  stripCrop,
  stripPreCrop,
  stampIconId,
  balanceMode,
  ambianceLine,
  pointsProgressTarget = DEFAULT_POINTS_TARGET,
}: WalletPassPreviewProps) {
  const t = useTranslations('Dashboard.bananoWalletDesigner');
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<PreviewView>('front');

  const cssVars = useMemo(() => {
    const bg = passColorToHex(background, DEFAULT_BG);
    const fg = passColorToHex(foreground, DEFAULT_FG);
    const lab = passColorToHex(labelColor, DEFAULT_LAB);
    return {
      '--wp-bg': bg,
      '--wp-fg': fg,
      '--wp-label': lab,
    } as React.CSSProperties;
  }, [background, foreground, labelColor]);

  const bgHex = passColorToHex(background, DEFAULT_BG);
  const fgHex = passColorToHex(foreground, DEFAULT_FG);
  const labHex = passColorToHex(labelColor, DEFAULT_LAB);

  const StampGlyph = STAMP_ICON_COMPONENTS[stampIconId] ?? STAMP_ICON_COMPONENTS.star;
  const dur = reduceMotion ? 0 : 0.45;
  const stripDur = reduceMotion ? 0 : 0.38;

  const pointsNum = Number(String(balanceValue).replace(/\D/g, '')) || 320;
  const progressPct = Math.min(100, Math.round((pointsNum / Math.max(1, pointsProgressTarget)) * 100));
  const hasStrip = Boolean(stripUrl);

  const viewTabs = (
    <div
      className="flex rounded-lg border border-zinc-700/80 bg-zinc-900/90 p-0.5 gap-0.5"
      role="tablist"
      aria-label={t('previewViewSwitcherAria')}
    >
      {(['front', 'back', 'detail'] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={view === k}
          onClick={() => setView(k)}
          className={`flex-1 min-h-[36px] rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
            view === k ? 'bg-white/[0.12] text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {k === 'front' ? t('previewViewFront') : k === 'back' ? t('previewViewBack') : t('previewViewDetail')}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="wallet-pass-preview w-full max-w-[288px] mx-auto space-y-2 text-[13px] leading-snug"
      style={cssVars}
    >
      {customCss ? (
        <style dangerouslySetInnerHTML={{ __html: customCss }} />
      ) : null}
      <p className="text-[9px] font-semibold uppercase tracking-wider text-center text-zinc-500">
        {t('previewBrand')}
      </p>
      {viewTabs}

      <div className="relative min-h-[200px]">
        <AnimatePresence mode="wait" initial={false}>
          {view === 'front' ? (
            <motion.div
              key="front"
              initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -4 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <div
                className="relative w-full overflow-hidden rounded-[14px] border border-white/[0.12] shadow-[0_20px_40px_-14px_rgba(0,0,0,0.65)]"
                style={{ maxWidth: CARD_MAX_W, marginLeft: 'auto', marginRight: 'auto' }}
              >
                <motion.div
                  className="wallet-pass-preview-card relative z-0 flex w-full flex-col overflow-hidden rounded-[inherit]"
                  animate={{ backgroundColor: bgHex }}
                  transition={{ duration: dur, ease: EASE }}
                  style={{ backgroundColor: bgHex }}
                >
                  <div className="relative z-10 flex w-full flex-col">
                    <div
                      className="wallet-pass-preview-strip relative z-10 mx-2 mt-2 w-[calc(100%-1rem)] shrink-0 overflow-hidden rounded-[10px] border border-white/10 shadow-sm"
                      style={{ aspectRatio: STRIP_ASPECT }}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {hasStrip ? (
                          <motion.div
                            key={stripUrl}
                            className="absolute inset-0"
                            initial={{ opacity: reduceMotion ? 1 : 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: reduceMotion ? 1 : 0 }}
                            transition={{ duration: stripDur, ease: EASE }}
                          >
                            <WalletPassStripHero
                              src={stripUrl!}
                              crop={stripCrop}
                              stripPreCrop={stripPreCrop}
                              className="h-full w-full rounded-[inherit]"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="strip-empty"
                            className="absolute inset-0"
                            style={{
                              background: `linear-gradient(135deg, ${bgHex} 0%, ${labHex}55 50%, ${bgHex} 100%)`,
                            }}
                            initial={{ opacity: reduceMotion ? 1 : 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: reduceMotion ? 1 : 0 }}
                            transition={{ duration: stripDur, ease: EASE }}
                            aria-hidden
                          />
                        )}
                      </AnimatePresence>

                      <div className="wallet-pass-preview-header pointer-events-none absolute left-0 right-0 top-0 z-20 px-2 pt-2 pb-1.5">
                        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-black/18">
                          <div className="flex items-start gap-2">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.18] bg-white/[0.08]"
                              aria-hidden
                            >
                              {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="px-0.5 text-center text-[9px] font-bold leading-tight text-white/85">
                                  {t('previewLogoPlaceholder')}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <motion.p
                                className="text-[12px] font-semibold leading-snug tracking-tight"
                                animate={{ color: fgHex }}
                                transition={{ duration: dur, ease: EASE }}
                                style={{ color: fgHex }}
                              >
                                {logoText || '…'}
                              </motion.p>
                              <motion.p
                                className="mt-0.5 text-[10px] font-medium leading-tight opacity-90"
                                animate={{ color: labHex }}
                                transition={{ duration: dur, ease: EASE }}
                                style={{ color: labHex }}
                              >
                                {t('previewKind')}
                              </motion.p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="wallet-pass-preview-fields relative z-10 mt-auto flex flex-col justify-end px-2 pb-2.5 pt-1.5">
                      <div className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-2.5 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-black/18">
                        <div className="space-y-2">
                          {ambianceLine ? (
                            <p
                              className="text-[10px] text-center font-medium leading-snug opacity-95"
                              style={{ color: labHex }}
                            >
                              {ambianceLine}
                            </p>
                          ) : null}

                          {balanceMode === 'points' ? (
                            <div>
                              <motion.p
                                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                                animate={{ color: labHex }}
                                transition={{ duration: dur, ease: EASE }}
                                style={{ color: labHex }}
                              >
                                {balanceLabel}
                              </motion.p>
                              <motion.p
                                className="mt-0.5 text-[32px] font-bold tabular-nums leading-none tracking-tight"
                                animate={{ color: fgHex }}
                                transition={{ duration: dur, ease: EASE }}
                                style={{ color: fgHex }}
                              >
                                {balanceValue}
                              </motion.p>
                              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/35 ring-1 ring-white/8">
                                <motion.div
                                  className="h-full rounded-full"
                                  initial={false}
                                  animate={{ width: `${progressPct}%` }}
                                  transition={{ duration: dur, ease: EASE }}
                                  style={{
                                    background: `linear-gradient(90deg, ${fgHex}cc, ${fgHex})`,
                                  }}
                                />
                              </div>
                              <p className="mt-2 text-[10px] leading-relaxed" style={{ color: labHex }}>
                                {t('previewPointsProgress', {
                                  current: pointsNum,
                                  next: pointsProgressTarget,
                                })}
                              </p>
                            </div>
                          ) : (
                            <>
                              <div>
                                <motion.p
                                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                                  animate={{ color: labHex }}
                                  transition={{ duration: dur, ease: EASE }}
                                  style={{ color: labHex }}
                                >
                                  {balanceLabel}
                                </motion.p>
                                <motion.p
                                  className="mt-0.5 text-[26px] font-semibold tabular-nums leading-none tracking-tight"
                                  animate={{ color: fgHex }}
                                  transition={{ duration: dur, ease: EASE }}
                                  style={{ color: fgHex }}
                                >
                                  {balanceValue}
                                </motion.p>
                              </div>
                              <p className="text-[11px] leading-snug" style={{ color: labHex }}>
                                {t('previewStampsAlmost', { count: DEMO_STAMPS_LEFT })}
                              </p>
                              <div className="border-t border-white/[0.1] pt-2">
                                <p
                                  className="text-[9px] font-semibold uppercase tracking-[0.14em] mb-1.5"
                                  style={{ color: labHex }}
                                >
                                  {t('previewStampsRow')}
                                </p>
                                <div className="flex gap-1 justify-start flex-wrap" aria-hidden>
                                  {[0, 1, 2, 3, 4].map((i) => (
                                    <motion.div
                                      key={`${stampIconId}-${i}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15"
                                      style={{
                                        backgroundColor: i < 3 ? `${fgHex}28` : 'transparent',
                                        color: fgHex,
                                      }}
                                      initial={reduceMotion ? false : { scale: 0.92, opacity: 0.7 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ duration: 0.25, delay: reduceMotion ? 0 : i * 0.04 }}
                                    >
                                      <StampGlyph className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          <div className="border-t border-white/[0.1] pt-2">
                            <motion.p
                              className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                              animate={{ color: labHex }}
                              transition={{ duration: dur, ease: EASE }}
                              style={{ color: labHex }}
                            >
                              {t('previewMember')}
                            </motion.p>
                            <motion.p
                              className="mt-0.5 text-[13px] font-medium leading-snug tracking-tight"
                              animate={{ color: fgHex }}
                              transition={{ duration: dur, ease: EASE }}
                              style={{ color: fgHex }}
                            >
                              {memberName}
                            </motion.p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute inset-0 z-[15] rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    aria-hidden
                  />
                </motion.div>
              </div>
            </motion.div>
          ) : null}

          {view === 'back' ? (
            <motion.div
              key="back"
              initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -4 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="rounded-[14px] border border-zinc-200/25 bg-zinc-100 text-zinc-900 shadow-[0_16px_36px_-12px_rgba(0,0,0,0.35)] overflow-hidden"
              style={{ maxWidth: CARD_MAX_W, marginLeft: 'auto', marginRight: 'auto' }}
            >
              <div className="border-b border-zinc-200/80 bg-white px-3 py-2.5">
                <p className="text-[11px] font-bold text-zinc-800">{t('previewBackTitle')}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{t('previewBackSubtitle')}</p>
              </div>
              <div className="px-3 py-3 space-y-3 bg-zinc-50/90">
                <div className="space-y-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t('previewBackRowLink')}
                  </p>
                  <p className="text-[11px] text-zinc-800 break-all leading-snug">{t('previewBackLinkDemo')}</p>
                </div>
                <div className="h-px bg-zinc-200/90" />
                <div className="space-y-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t('previewBackRowHistory')}
                  </p>
                  <p className="text-[11px] text-zinc-700 leading-relaxed">{t('previewBackHistoryDemo')}</p>
                </div>
                <div className="h-px bg-zinc-200/90" />
                <div className="space-y-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t('previewBackRowMember')}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-900">{memberName}</p>
                </div>
              </div>
            </motion.div>
          ) : null}

          {view === 'detail' ? (
            <motion.div
              key="detail"
              initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -4 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="rounded-[14px] border border-white/[0.1] overflow-hidden shadow-[0_24px_48px_-16px_rgba(0,0,0,0.55)]"
              style={{
                maxWidth: CARD_MAX_W,
                marginLeft: 'auto',
                marginRight: 'auto',
                backgroundColor: bgHex,
              }}
            >
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.08]">
                <p className="text-[11px] font-semibold" style={{ color: fgHex }}>
                  {t('previewDetailTitle')}
                </p>
                <p className="text-[10px] mt-0.5 opacity-85" style={{ color: labHex }}>
                  {t('previewDetailSubtitle')}
                </p>
              </div>
              <div className="px-4 py-5 flex flex-col items-center gap-4">
                <div
                  className="rounded-2xl bg-white p-3 shadow-inner border border-zinc-200/80"
                  aria-hidden
                >
                  <QrCode className="w-[120px] h-[120px] text-zinc-900" strokeWidth={1.25} />
                </div>
                <p className="text-[10px] text-center leading-relaxed px-1" style={{ color: labHex }}>
                  {t('previewDetailQrCaption')}
                </p>
                <div
                  className="w-full h-10 rounded-md border border-dashed border-white/20 flex items-center justify-center"
                  style={{ backgroundColor: `${fgHex}12` }}
                >
                  <span className="text-[9px] font-mono tracking-widest opacity-70" style={{ color: fgHex }}>
                    |||  ·  ·  ·  ·  ·  ·  ·  ·  |||
                  </span>
                </div>
                <p className="text-[9px] text-center opacity-80" style={{ color: labHex }}>
                  {t('previewDetailBarcodeCaption')}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
