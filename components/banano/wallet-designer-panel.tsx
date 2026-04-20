'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import {
  Beef,
  Building2,
  Coffee,
  Croissant,
  Dumbbell,
  Flower2,
  ImageUp,
  Info,
  Loader2,
  Crop,
  Palette,
  Pill,
  Save,
  Scissors,
  Shirt,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { WalletPassPreview } from '@/components/banano/wallet-pass-preview';
import { WalletStripCropDialog } from '@/components/banano/wallet-strip-crop-dialog';
import { passColorToHex } from '@/lib/banano/wallet-design-utils';
import type { WalletDesignPayload } from '@/lib/banano/wallet-design-types';
import {
  isWalletThemeIllustrationId,
  type WalletThemeIllustrationId,
} from '@/lib/banano/wallet-theme-illustrations';
import {
  getWalletTradePresetById,
  WALLET_TRADE_PRESETS,
  WALLET_STAMP_ICON_IDS,
  isWalletStampIconId,
  type WalletStampIconId,
} from '@/lib/wallet/presets';
import { STAMP_ICON_COMPONENTS } from '@/lib/wallet/stamp-icon-map';
import {
  getWalletArchetypeById,
  isWalletArchetypeId,
  resolveArchetypeForDesigner,
  type WalletArchetypeId,
} from '@/lib/wallet/archetypes';
import {
  parseWalletStripCropJson,
  UNIVERSAL_STRIP_CROP_DEFAULT,
  type WalletStripCrop,
} from '@/lib/wallet/wallet-strip-crop';

const DEFAULT_BG = '#0f172a';
const DEFAULT_FG = '#fef3c7';
const DEFAULT_LAB = '#94a3b8';

const ACCENT = '#BF174C';

const STRIP_MIN_WIDTH_PX = 1125;

async function getBitmapDimensionsFromFile(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    try {
      return { width: bmp.width, height: bmp.height };
    } finally {
      bmp.close();
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

const PRESET_ICONS: Record<string, LucideIcon> = {
  bakery: Croissant,
  butcher: Beef,
  cafe: Coffee,
  restaurant: UtensilsCrossed,
  hair: Scissors,
  florist: Flower2,
  pharmacy: Pill,
  garage: Wrench,
  beauty: Sparkles,
  retail: Shirt,
  fitness: Dumbbell,
  hotel: Building2,
};

export function WalletDesignerPanel() {
  const t = useTranslations('Dashboard.bananoWalletDesigner');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bg, setBg] = useState(DEFAULT_BG);
  const [fg, setFg] = useState(DEFAULT_FG);
  const [lab, setLab] = useState(DEFAULT_LAB);
  const [logoText, setLogoText] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [customCss, setCustomCss] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [uploadBusy, setUploadBusy] = useState<'logo' | 'strip' | null>(null);
  const [stripTooNarrow, setStripTooNarrow] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [themeIllustrationId, setThemeIllustrationId] = useState<WalletThemeIllustrationId | null>(null);
  const [stampIconId, setStampIconId] = useState<WalletStampIconId>('star');
  const [archetypeId, setArchetypeId] = useState<WalletArchetypeId | null>(null);
  const [loyaltyMode, setLoyaltyMode] = useState<'stamps' | 'points'>('points');
  const [previewBalanceMode, setPreviewBalanceMode] = useState<'stamps' | 'points' | null>(null);
  const [stripCrop, setStripCrop] = useState<WalletStripCrop>(UNIVERSAL_STRIP_CROP_DEFAULT);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  const applyPayload = useCallback((d: WalletDesignPayload) => {
    setBg(passColorToHex(d.background_color, DEFAULT_BG));
    setFg(passColorToHex(d.foreground_color, DEFAULT_FG));
    setLab(passColorToHex(d.label_color, DEFAULT_LAB));
    setLogoText(d.logo_text ?? '');
    setLogoUrl(d.logo_url);
    const archForStripUrl =
      d.archetype_id && isWalletArchetypeId(d.archetype_id)
        ? getWalletArchetypeById(d.archetype_id)?.stripImageUrl
        : null;
    setStripUrl(d.strip_image_url ?? archForStripUrl ?? null);
    setStripTooNarrow(false);
    setCustomCss(d.custom_css ?? '');
    setEstablishmentName(d.establishment_name ?? '');
    const archForTheme =
      d.archetype_id && isWalletArchetypeId(d.archetype_id) ? getWalletArchetypeById(d.archetype_id) : null;
    const archetypeUsesHdCharacter = Boolean(archForTheme?.characterImageUrl.includes('/wallet-archetypes/'));
    setThemeIllustrationId(
      archetypeUsesHdCharacter
        ? null
        : d.theme_illustration_id && isWalletThemeIllustrationId(d.theme_illustration_id)
          ? d.theme_illustration_id
          : null
    );
    setStampIconId(
      d.stamp_icon_id && isWalletStampIconId(d.stamp_icon_id) ? d.stamp_icon_id : 'star'
    );
    setArchetypeId(
      d.archetype_id && isWalletArchetypeId(d.archetype_id) ? d.archetype_id : null
    );
    setLoyaltyMode(d.loyalty_mode);
    setPreviewBalanceMode(d.preview_balance_mode);
    const parsedCrop = parseWalletStripCropJson(d.strip_crop);
    const archForCrop =
      d.archetype_id && isWalletArchetypeId(d.archetype_id)
        ? getWalletArchetypeById(d.archetype_id)
        : undefined;
    setStripCrop(parsedCrop ?? archForCrop?.defaultStripCrop ?? UNIVERSAL_STRIP_CROP_DEFAULT);
  }, []);

  const applyLocalPreset = useCallback(
    (presetId: string) => {
      if (!isWalletArchetypeId(presetId)) return;
      const { archetype, custom_css, themeIllustrationId: th } = resolveArchetypeForDesigner(presetId);
      setBg(archetype.bg_color);
      setFg(archetype.text_color);
      setLab(archetype.label_color);
      setCustomCss(custom_css ?? '');
      setStripUrl(archetype.stripImageUrl);
      setThemeIllustrationId(th);
      setStampIconId(archetype.stampIconId);
      setArchetypeId(presetId);
      setStripCrop(archetype.defaultStripCrop);
      setAiRationale(null);
      toast.success(t('presetAppliedToast'));
    },
    [t]
  );

  const runAiSuggest = useCallback(async () => {
    const q = aiPrompt.trim();
    if (!q) {
      toast.error(t('aiEmptyPrompt'));
      return;
    }
    setAiBusy(true);
    setAiRationale(null);
    try {
      const r = await fetch('/api/banano/wallet/design/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
      });
      const data = (await r.json()) as {
        background_color?: string;
        foreground_color?: string;
        label_color?: string;
        custom_css?: string | null;
        rationale?: string | null;
        logo_text_suggestion?: string | null;
        illustration_theme?: string | null;
        error?: string;
      };
      if (!r.ok) {
        if (data.error === 'openai_unavailable') toast.error(t('aiUnavailable'));
        else toast.error(t('aiError'));
        return;
      }
      setBg(passColorToHex(data.background_color, DEFAULT_BG));
      setFg(passColorToHex(data.foreground_color, DEFAULT_FG));
      setLab(passColorToHex(data.label_color, DEFAULT_LAB));
      setCustomCss(typeof data.custom_css === 'string' ? data.custom_css : '');
      if (typeof data.logo_text_suggestion === 'string' && data.logo_text_suggestion.trim()) {
        setLogoText(data.logo_text_suggestion.trim().slice(0, 64));
      }
      if (typeof data.illustration_theme === 'string') {
        const tid = data.illustration_theme.trim();
        if (isWalletThemeIllustrationId(tid)) {
          if (isWalletArchetypeId(tid)) {
            const { archetype, custom_css, themeIllustrationId: th } = resolveArchetypeForDesigner(tid);
            setThemeIllustrationId(th);
            setStripUrl(archetype.stripImageUrl);
            setStampIconId(archetype.stampIconId);
            setBg(archetype.bg_color);
            setFg(archetype.text_color);
            setLab(archetype.label_color);
            setCustomCss(custom_css ?? '');
            setArchetypeId(tid);
            setStripCrop(archetype.defaultStripCrop);
          } else {
            setThemeIllustrationId(tid);
            const trade = getWalletTradePresetById(tid);
            if (trade) {
              setStripUrl(trade.strip_url);
              setStampIconId(trade.default_stamp_icon);
            }
          }
        }
      }
      setAiRationale(typeof data.rationale === 'string' ? data.rationale : null);
      toast.success(t('aiAppliedToast'));
    } catch {
      toast.error(t('aiError'));
    } finally {
      setAiBusy(false);
    }
  }, [aiPrompt, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/banano/wallet/design');
      const data = (await r.json()) as WalletDesignPayload & { error?: string };
      if (!r.ok || data.error) {
        toast.error(t('loadError'));
        return;
      }
      applyPayload(data);
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [applyPayload, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/banano/wallet/design', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          background_color: bg,
          foreground_color: fg,
          label_color: lab,
          logo_text: logoText.trim() || null,
          logo_url: logoUrl,
          strip_image_url: stripUrl,
          custom_css: customCss.trim() || null,
          theme_illustration_id: themeIllustrationId,
          stamp_icon_id: stampIconId,
          archetype_id: archetypeId,
          preview_balance_mode: previewBalanceMode,
          strip_crop: stripCrop,
        }),
      });
      const data = (await r.json()) as WalletDesignPayload & { error?: string };
      if (!r.ok || data.error) {
        toast.error(t('saveError'));
        return;
      }
      applyPayload(data);
      toast.success(t('saveSuccess'));
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File, kind: 'logo' | 'strip') => {
    setUploadBusy(kind);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const r = await fetch('/api/banano/wallet/design/upload', { method: 'POST', body: fd });
      const j = (await r.json()) as { publicUrl?: string; error?: string };
      if (!r.ok || !j.publicUrl) {
        toast.error(t('uploadFailed'));
        return;
      }
      if (kind === 'logo') setLogoUrl(j.publicUrl);
      else {
        setStripUrl(j.publicUrl);
        setArchetypeId(null);
        setStripCrop(UNIVERSAL_STRIP_CROP_DEFAULT);
      }
      toast.success(t('uploadSuccess'));
    } catch {
      toast.error(t('uploadFailed'));
    } finally {
      setUploadBusy(null);
    }
  };

  const onStripFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setStripTooNarrow(false);
    try {
      const { width } = await getBitmapDimensionsFromFile(file);
      setStripTooNarrow(width < STRIP_MIN_WIDTH_PX);
    } catch {
      setStripTooNarrow(false);
    }
    void uploadFile(file, 'strip');
  };

  const sampleName =
    establishmentName.trim().length > 0 ? establishmentName.trim() : t('sampleMemberName');

  const effectivePreviewMode = previewBalanceMode ?? loyaltyMode;

  const stripPreCrop = useMemo(() => {
    if (!archetypeId || !stripUrl) return null;
    const a = getWalletArchetypeById(archetypeId);
    if (!a?.stripPreCrop) return null;
    const usingArchetypeAsset = stripUrl === a.stripImageUrl || stripUrl === a.characterImageUrl;
    return usingArchetypeAsset ? a.stripPreCrop : null;
  }, [archetypeId, stripUrl]);

  const ambianceLine = useMemo(() => {
    if (!archetypeId) return null;
    const a = getWalletArchetypeById(archetypeId);
    if (!a) return null;
    return (t as (key: string) => string)(`archetype_ambiance.${a.ambianceI18nSuffix}`);
  }, [archetypeId, t]);

  const highlightedPresetId = archetypeId;

  const presetRail = !loading ? (
    <aside className="rounded-[14px] border border-zinc-700/50 bg-zinc-950/90 p-3 sm:p-4 space-y-4 min-w-0 xl:sticky xl:top-24 xl:self-start">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
          {t('sectionPresetRail')}
        </h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t('sectionPresetRailLead')}</p>
        <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed">{t('themeIllustrationHint')}</p>
        <label className="block mt-3 text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{t('sectionArchetypeSelect')}</span>
          <select
            value={archetypeId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setArchetypeId(null);
                return;
              }
              if (isWalletArchetypeId(v)) applyLocalPreset(v);
            }}
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-2.5 text-sm text-zinc-100"
          >
            <option value="">{t('archetypeNone')}</option>
            {WALLET_TRADE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`preset_${p.id}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{t('sectionBalancePreview')}</p>
          <div className="flex rounded-[10px] border border-zinc-700 p-0.5 bg-zinc-900/90 gap-0.5">
            <button
              type="button"
              onClick={() => setPreviewBalanceMode('points')}
              className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition-colors ${
                effectivePreviewMode === 'points'
                  ? 'bg-[#BF174C]/90 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t('balanceModePoints')}
            </button>
            <button
              type="button"
              onClick={() => setPreviewBalanceMode('stamps')}
              className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition-colors ${
                effectivePreviewMode === 'stamps'
                  ? 'bg-[#BF174C]/90 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t('balanceModeStamps')}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-zinc-600 leading-relaxed">{t('previewLoyaltyHint', { mode: loyaltyMode === 'points' ? t('balanceModePoints') : t('balanceModeStamps') })}</p>
            {previewBalanceMode !== null ? (
              <button
                type="button"
                onClick={() => setPreviewBalanceMode(null)}
                className="text-[10px] font-medium text-amber-500/90 hover:text-amber-400 shrink-0"
              >
                {t('previewResetLoyalty')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {WALLET_TRADE_PRESETS.map((p) => {
          const Icon = PRESET_ICONS[p.id] ?? Palette;
          const selected = highlightedPresetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyLocalPreset(p.id)}
              className={`group flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-[#BF174C]/70 ${
                selected
                  ? 'border-[#BF174C] bg-[#BF174C]/12 ring-2 ring-[#BF174C]/75'
                  : 'border-zinc-700/80 bg-zinc-900/50 hover:border-[#BF174C]/45 hover:bg-zinc-900'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-[10px] border bg-black/35 ${
                  selected ? 'border-[#BF174C]/50 text-[#f47296]' : 'border-white/10 text-amber-400/90'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden />
              </span>
              <span className="text-[11px] font-semibold text-zinc-100 leading-tight line-clamp-2">
                {t(`preset_${p.id}`)}
              </span>
              <span className="flex gap-0.5 justify-center">
                <span className="h-3 w-3 rounded-sm border border-white/15" style={{ background: p.bg_color }} aria-hidden />
                <span className="h-3 w-3 rounded-sm border border-white/15" style={{ background: p.text_color }} aria-hidden />
                <span className="h-3 w-3 rounded-sm border border-white/15" style={{ background: p.label_color }} aria-hidden />
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          setThemeIllustrationId(null);
          setArchetypeId(null);
        }}
        className="text-xs font-medium text-zinc-500 hover:text-zinc-300 underline underline-offset-2 w-full text-left"
      >
        {t('clearThemeIllustration')}
      </button>

      <div className="border-t border-zinc-800 pt-4 space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-400">{t('sectionStampIcons')}</h4>
        <p className="text-[11px] text-zinc-600 leading-relaxed">{t('sectionStampIconsLead')}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {WALLET_STAMP_ICON_IDS.map((id) => {
            const Cmp = STAMP_ICON_COMPONENTS[id];
            const active = stampIconId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStampIconId(id)}
                title={t(`stampIcon_${id}`)}
                aria-label={t(`stampIcon_${id}`)}
                aria-pressed={active}
                className={`flex h-10 w-full items-center justify-center rounded-lg border transition-colors ${
                  active
                    ? 'border-[#BF174C] bg-[#BF174C]/15 text-[#fda4c4]'
                    : 'border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                <Cmp className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-3">{t('designAccentTip')}</p>
    </aside>
  ) : null;

  return (
    <>
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(280px,360px)] gap-6 lg:gap-8 items-start w-full max-w-[1400px] mx-auto px-1">
      {loading ? (
        <div className="xl:col-span-3 flex items-center gap-2 text-zinc-400 py-16 justify-center rounded-[14px] border border-zinc-700/50 bg-zinc-950/80">
          <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden />
          {t('loading')}
        </div>
      ) : (
        <>
          {presetRail}

          <section className="rounded-[14px] border border-zinc-700/50 bg-zinc-950/80 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] p-4 sm:p-6 space-y-6 min-w-0">
            <header className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400/90">
                <Palette className="w-5 h-5 shrink-0" aria-hidden />
                <h2 className="text-lg font-display font-bold text-zinc-50">{t('panelTitle')}</h2>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('panelLead')}</p>
            </header>

            <div className="rounded-[12px] border border-violet-500/25 bg-gradient-to-br from-violet-950/40 to-zinc-950/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-violet-300/90">
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-wide">{t('sectionAi')}</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{t('sectionAiLead')}</p>
              <label className="block text-sm text-zinc-300">
                <span className="sr-only">{t('aiPromptLabel')}</span>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  disabled={aiBusy}
                  className="mt-1 w-full rounded-[12px] border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:opacity-60"
                  placeholder={t('aiPromptPlaceholder')}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => void runAiSuggest()}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[12px] bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" aria-hidden />}
                  {aiBusy ? t('aiGenerating') : t('aiGenerate')}
                </button>
              </div>
              {aiRationale ? (
                <p className="text-xs text-violet-200/80 leading-relaxed border-t border-white/10 pt-3">{aiRationale}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t('sectionColors')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block space-y-1.5 text-sm text-zinc-300">
                  {t('fieldBackground')}
                  <input
                    type="color"
                    value={bg}
                    onChange={(e) => setBg(e.target.value)}
                    className="mt-1 w-full h-11 min-h-[44px] rounded-[12px] border border-zinc-600 bg-zinc-900 cursor-pointer"
                  />
                </label>
                <label className="block space-y-1.5 text-sm text-zinc-300">
                  {t('fieldForeground')}
                  <input
                    type="color"
                    value={fg}
                    onChange={(e) => setFg(e.target.value)}
                    className="mt-1 w-full h-11 min-h-[44px] rounded-[12px] border border-zinc-600 bg-zinc-900 cursor-pointer"
                  />
                </label>
                <label className="block space-y-1.5 text-sm text-zinc-300">
                  {t('fieldLabelColor')}
                  <input
                    type="color"
                    value={lab}
                    onChange={(e) => setLab(e.target.value)}
                    className="mt-1 w-full h-11 min-h-[44px] rounded-[12px] border border-zinc-600 bg-zinc-900 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t('sectionMedia')}</h3>
              <label className="block rounded-[12px] border border-dashed border-zinc-600 bg-zinc-900/40 px-4 py-4 hover:border-zinc-500 transition-colors cursor-pointer max-w-xl">
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <ImageUp className="w-4 h-4 shrink-0 text-zinc-400" aria-hidden />
                  {t('fieldLogoUpload')}
                </span>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{t('fieldLogoHint')}</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploadBusy !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void uploadFile(f, 'logo');
                  }}
                />
                {uploadBusy === 'logo' ? <p className="text-xs text-zinc-500 mt-2">{t('uploading')}</p> : null}
              </label>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] gap-4 items-start">
                <label className="block rounded-[12px] border border-dashed border-zinc-600 bg-zinc-900/40 px-4 py-4 hover:border-zinc-500 transition-colors cursor-pointer min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <ImageUp className="w-4 h-4 shrink-0 text-zinc-400" aria-hidden />
                    {t('fieldStripUpload')}
                  </span>
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{t('fieldStripHint')}</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadBusy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void onStripFileSelected(f);
                    }}
                  />
                  {uploadBusy === 'strip' ? <p className="text-xs text-zinc-500 mt-2">{t('uploading')}</p> : null}
                  {stripTooNarrow ? (
                    <p
                      className="text-xs text-amber-200/95 mt-3 rounded-lg border border-amber-500/35 bg-amber-950/50 px-2.5 py-2 leading-relaxed"
                      role="status"
                    >
                      {t('guidelines.stripTooNarrow')}
                    </p>
                  ) : null}
                  {stripUrl ? (
                    <button
                      type="button"
                      onClick={() => setCropDialogOpen(true)}
                      className="mt-3 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900/90 px-3 text-sm font-medium text-zinc-200 hover:border-[#BF174C]/50 hover:bg-zinc-800"
                    >
                      <Crop className="w-4 h-4 shrink-0 text-zinc-400" aria-hidden />
                      {t('stripCropOpenButton')}
                    </button>
                  ) : null}
                </label>

                <div
                  className="rounded-[12px] border border-amber-500/25 bg-gradient-to-br from-amber-950/35 to-zinc-950/80 px-4 py-3 space-y-2.5 min-w-0"
                  aria-labelledby="wallet-elite-tips-title"
                >
                  <div className="flex items-center gap-2 text-amber-300/95">
                    <Info className="w-4 h-4 shrink-0" aria-hidden />
                    <h4 id="wallet-elite-tips-title" className="text-xs font-bold uppercase tracking-wide">
                      {t('guidelines.eliteTipsTitle')}
                    </h4>
                  </div>
                  <ul className="text-xs text-zinc-300/95 space-y-2 leading-relaxed list-none pl-0">
                    <li className="flex gap-2">
                      <span className="text-amber-400/80 shrink-0" aria-hidden>
                        ·
                      </span>
                      <span>{t('guidelines.idealFormat')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-400/80 shrink-0" aria-hidden>
                        ·
                      </span>
                      <span>{t('guidelines.qualityHint')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-400/80 shrink-0" aria-hidden>
                        ·
                      </span>
                      <span>{t('guidelines.safeZone')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t('sectionTitleField')}</h3>
              <label className="block text-sm text-zinc-300">
                {t('fieldLogoText')}
                <input
                  type="text"
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  maxLength={64}
                  className="mt-1 w-full min-h-[44px] rounded-[12px] border border-zinc-600 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-600"
                  placeholder={t('fieldLogoTextPlaceholder')}
                />
              </label>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t('sectionAdvanced')}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{t('hintCustomCss')}</p>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                rows={4}
                className="w-full rounded-[12px] border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 font-mono"
                placeholder={t('fieldCustomCssPlaceholder')}
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-[12px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 shadow-md"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" aria-hidden />}
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </section>

          <aside className="lg:sticky lg:top-24 rounded-[14px] border border-zinc-700/40 bg-zinc-900/60 p-4 sm:p-6 shadow-inner min-w-0 w-full">
            <div className="flex items-center gap-2 text-zinc-400 mb-4">
              <Smartphone className="w-4 h-4" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide">{t('previewSection')}</span>
            </div>
            <WalletPassPreview
              logoText={
                logoText.trim().length > 0
                  ? logoText.trim()
                  : establishmentName.trim().length > 0
                    ? establishmentName.trim()
                    : t('previewFallbackTitle')
              }
              memberName={sampleName}
              balanceLabel={
                effectivePreviewMode === 'points' ? t('previewPointsLabel') : t('previewStampsLabel')
              }
              balanceValue={
                effectivePreviewMode === 'points' ? t('previewPointsValue') : t('previewStampsValue')
              }
              background={bg}
              foreground={fg}
              labelColor={lab}
              logoUrl={logoUrl}
              stripUrl={stripUrl}
              customCss={customCss.trim().length > 0 ? customCss : null}
              stripCrop={stripCrop}
              stripPreCrop={stripPreCrop}
              stampIconId={stampIconId}
              balanceMode={effectivePreviewMode}
              ambianceLine={ambianceLine}
            />
          </aside>
        </>
      )}
    </div>
    <WalletStripCropDialog
      open={cropDialogOpen}
      onClose={() => setCropDialogOpen(false)}
      value={stripCrop}
      onApply={setStripCrop}
      canResetArchetype={Boolean(archetypeId)}
      onResetToArchetype={
        archetypeId
          ? () => {
              const a = getWalletArchetypeById(archetypeId);
              if (a) setStripCrop(a.defaultStripCrop);
            }
          : undefined
      }
    />
    </>
  );
}

export default WalletDesignerPanel;
