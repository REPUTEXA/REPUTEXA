'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Copy, Loader2, RefreshCw, Settings2, Sparkles } from 'lucide-react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type {
  BananoLoyaltyMerchantConfig,
  BananoVoucherRewardKind,
  LoyaltyProgramSideConfig,
} from '@/lib/banano/loyalty-profile';
import { effectiveEarnCredit, isBonusPerEuroStackingActive } from '@/lib/banano/loyalty-bonus';

type Props = {
  loyalty: BananoLoyaltyMerchantConfig;
  onSaved: (next: BananoLoyaltyMerchantConfig) => void;
  onRefreshBootstrap?: () => void | Promise<void>;
};

const REPUTEXA_SYNC_WINDOWS_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_REPUTEXA_SYNC_WINDOWS_URL?.trim()) || '';

function parseNonNegInt(raw: string, fallback: number): number {
  const n = Math.floor(parseInt(raw, 10));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function parseRatePerEuro(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return 0;
  const x = Number(t);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(100_000, x);
}

const BONUS_PRESET_IDS = ['noel', 'nouvel_an', 'st_valentin', 'ete'] as const;

/** Référence stable pour éviter les littéraux dans le JSX (ESLint i18n / jsx-only). */
const VOUCHER_AT_THRESHOLD_SIDE_POINTS = 'points' as const;
const VOUCHER_AT_THRESHOLD_SIDE_STAMPS = 'stamps' as const;

const BONUS_PRESET_RANGES: Record<
  (typeof BONUS_PRESET_IDS)[number],
  (year: number) => { start: string; end: string }
> = {
  noel: (y) => ({ start: `${y}-12-10`, end: `${y}-12-31` }),
  nouvel_an: (y) => ({ start: `${y}-12-28`, end: `${y + 1}-01-07` }),
  st_valentin: (y) => ({ start: `${y}-02-10`, end: `${y}-02-15` }),
  ete: (y) => ({ start: `${y}-07-01`, end: `${y}-08-31` }),
};

const USER_PRESETS_STORAGE_KEY = 'banano-loyalty-bonus-presets-v1';

type UserBonusPreset = { id: string; label: string; start: string; end: string };

type PresetEditorState = {
  scope: 'builtin' | 'user';
  id: string;
  label: string;
  start: string;
  end: string;
};

function readUserPresetsFromStorage(): UserBonusPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => {
        const o = x as Record<string, unknown>;
        const id = typeof o.id === 'string' ? o.id : '';
        const label = typeof o.label === 'string' ? o.label : '';
        const start = typeof o.start === 'string' ? o.start.slice(0, 10) : '';
        const end = typeof o.end === 'string' ? o.end.slice(0, 10) : '';
        if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
        return { id, label: label || '', start, end };
      })
      .filter((x): x is UserBonusPreset => x != null);
  } catch {
    return [];
  }
}

export function BananoLoyaltyMerchantSettings({ loyalty, onSaved, onRefreshBootstrap }: Props) {
  const t = useTranslations('Dashboard.bananoLoyaltySettings');
  const locale = useLocale();
  const formatYmd = useCallback(
    (ymd: string) => {
      const s = ymd.trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ymd;
      const d = new Date(`${s}T12:00:00Z`);
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(d);
    },
    [locale]
  );
  /** new Date() differs between SSR and client; suppressHydrationWarning avoids removeChild hydration failures. */
  const todayParisLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'Europe/Paris',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date()),
    [locale]
  );

  const [programMode, setProgramMode] = useState<'points' | 'stamps'>(loyalty.mode);
  const [thresholdPoints, setThresholdPoints] = useState(String(loyalty.pointsProgram.threshold));
  const [thresholdStamps, setThresholdStamps] = useState(String(loyalty.stampsProgram.threshold));
  const [rewardTextPoints, setRewardTextPoints] = useState(loyalty.pointsProgram.rewardText);
  const [rewardTextStamps, setRewardTextStamps] = useState(loyalty.stampsProgram.rewardText);
  const [pointsPerEuro, setPointsPerEuro] = useState(() =>
    loyalty.pointsPerEuro === 0 ? '' : String(loyalty.pointsPerEuro)
  );
  const [stampsPerVisit, setStampsPerVisit] = useState(String(loyalty.stampsPerVisit));
  const [stampsPerEuro, setStampsPerEuro] = useState(() =>
    loyalty.stampsPerEuro === 0 ? '' : String(loyalty.stampsPerEuro)
  );
  const [bonusEnabled, setBonusEnabled] = useState(loyalty.bonus.enabled);
  const [bonusStart, setBonusStart] = useState(loyalty.bonus.startDate ?? '');
  const [bonusEnd, setBonusEnd] = useState(loyalty.bonus.endDate ?? '');
  const [bonusPointsPerEuro, setBonusPointsPerEuro] = useState(() =>
    loyalty.bonus.pointsExtraPerEuro > 0 ? String(loyalty.bonus.pointsExtraPerEuro) : ''
  );
  const [bonusStampsPerEuro, setBonusStampsPerEuro] = useState(() =>
    loyalty.bonus.stampsExtraPerEuro > 0 ? String(loyalty.bonus.stampsExtraPerEuro) : ''
  );
  const [userPresets, setUserPresets] = useState<UserBonusPreset[]>([]);
  const [presetEditor, setPresetEditor] = useState<PresetEditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [cashSyncBusy, setCashSyncBusy] = useState(false);
  const [cashSyncLive, setCashSyncLive] = useState<boolean | null>(null);
  const [cashSyncTerminalCount, setCashSyncTerminalCount] = useState<number | null>(null);
  const [voucherPointsKind, setVoucherPointsKind] =
    useState<BananoVoucherRewardKind>('label_only');
  const [voucherPointsPercent, setVoucherPointsPercent] = useState('');
  const [voucherPointsEuros, setVoucherPointsEuros] = useState('');
  const [voucherPointsValidityDays, setVoucherPointsValidityDays] = useState('');
  const [voucherPointsWhatsApp, setVoucherPointsWhatsApp] = useState(false);
  const [voucherStampsKind, setVoucherStampsKind] =
    useState<BananoVoucherRewardKind>('label_only');
  const [voucherStampsPercent, setVoucherStampsPercent] = useState('');
  const [voucherStampsEuros, setVoucherStampsEuros] = useState('');
  const [voucherStampsValidityDays, setVoucherStampsValidityDays] = useState('');
  const [voucherStampsWhatsApp, setVoucherStampsWhatsApp] = useState(false);
  const [signupWelcomeEnabled, setSignupWelcomeEnabled] = useState(loyalty.signupWelcome.enabled);
  const [signupWelcomeKind, setSignupWelcomeKind] =
    useState<BananoVoucherRewardKind>(loyalty.signupWelcome.voucherRewardKind);
  const [signupWelcomePercent, setSignupWelcomePercent] = useState('');
  const [signupWelcomeEuros, setSignupWelcomeEuros] = useState('');
  const [signupWelcomeLabel, setSignupWelcomeLabel] = useState(loyalty.signupWelcome.rewardLabel);
  const [signupWelcomeValidityDays, setSignupWelcomeValidityDays] = useState('');

  const persistUserPresets = useCallback((next: UserBonusPreset[]) => {
    setUserPresets(next);
    try {
      localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setUserPresets(readUserPresetsFromStorage());
  }, []);

  function hydrateVoucherFields(side: LoyaltyProgramSideConfig, which: 'points' | 'stamps') {
    const setK = which === 'points' ? setVoucherPointsKind : setVoucherStampsKind;
    const setP = which === 'points' ? setVoucherPointsPercent : setVoucherStampsPercent;
    const setE = which === 'points' ? setVoucherPointsEuros : setVoucherStampsEuros;
    const setV = which === 'points' ? setVoucherPointsValidityDays : setVoucherStampsValidityDays;
    const setW = which === 'points' ? setVoucherPointsWhatsApp : setVoucherStampsWhatsApp;
    setK(side.voucherRewardKind);
    setP(
      side.voucherRewardKind === 'percent' && side.voucherRewardPercent > 0
        ? String(side.voucherRewardPercent)
        : ''
    );
    setE(
      side.voucherRewardKind === 'fixed_euro' && side.voucherRewardEuroCents > 0
        ? String(side.voucherRewardEuroCents / 100)
        : ''
    );
    setV(side.voucherValidityDays != null ? String(side.voucherValidityDays) : '');
    setW(side.voucherWhatsAppEnabled);
  }

  useEffect(() => {
    setProgramMode(loyalty.mode);
    setThresholdPoints(String(loyalty.pointsProgram.threshold));
    setThresholdStamps(String(loyalty.stampsProgram.threshold));
    setRewardTextPoints(loyalty.pointsProgram.rewardText);
    setRewardTextStamps(loyalty.stampsProgram.rewardText);
    setPointsPerEuro(loyalty.pointsPerEuro === 0 ? '' : String(loyalty.pointsPerEuro));
    setStampsPerVisit(String(loyalty.stampsPerVisit));
    setStampsPerEuro(loyalty.stampsPerEuro === 0 ? '' : String(loyalty.stampsPerEuro));
    setBonusEnabled(loyalty.bonus.enabled);
    setBonusStart(loyalty.bonus.startDate ?? '');
    setBonusEnd(loyalty.bonus.endDate ?? '');
    setBonusPointsPerEuro(
      loyalty.bonus.pointsExtraPerEuro > 0 ? String(loyalty.bonus.pointsExtraPerEuro) : ''
    );
    setBonusStampsPerEuro(
      loyalty.bonus.stampsExtraPerEuro > 0 ? String(loyalty.bonus.stampsExtraPerEuro) : ''
    );
    hydrateVoucherFields(loyalty.pointsProgram, 'points');
    hydrateVoucherFields(loyalty.stampsProgram, 'stamps');
    setSignupWelcomeEnabled(loyalty.signupWelcome.enabled);
    setSignupWelcomeKind(loyalty.signupWelcome.voucherRewardKind);
    setSignupWelcomePercent(
      loyalty.signupWelcome.voucherRewardKind === 'percent' && loyalty.signupWelcome.voucherRewardPercent > 0
        ? String(loyalty.signupWelcome.voucherRewardPercent)
        : ''
    );
    setSignupWelcomeEuros(
      loyalty.signupWelcome.voucherRewardKind === 'fixed_euro' &&
        loyalty.signupWelcome.voucherRewardEuroCents > 0
        ? String(loyalty.signupWelcome.voucherRewardEuroCents / 100)
        : ''
    );
    setSignupWelcomeLabel(loyalty.signupWelcome.rewardLabel);
    setSignupWelcomeValidityDays(
      loyalty.signupWelcome.validityDays != null ? String(loyalty.signupWelcome.validityDays) : ''
    );
  }, [loyalty]);

  useEffect(() => {
    if (!loyalty.bananoPilotageIngestSecret) {
      setCashSyncLive(null);
      setCashSyncTerminalCount(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('banano_cash_ingestions')
        .select('terminal_id')
        .eq('merchant_id', user.id)
        .gte('ticket_at', since);
      if (cancelled) return;
      if (error) {
        setCashSyncLive(false);
        setCashSyncTerminalCount(null);
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setCashSyncLive(rows.length > 0);
      const ids = new Set<string>();
      for (const r of rows) {
        const tid =
          r && typeof (r as { terminal_id?: string | null }).terminal_id === 'string'
            ? String((r as { terminal_id?: string | null }).terminal_id).trim()
            : '';
        if (tid) ids.add(tid);
      }
      setCashSyncTerminalCount(ids.size);
    };
    void poll();
    const tmr = window.setInterval(() => void poll(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(tmr);
    };
  }, [loyalty.bananoPilotageIngestSecret]);

  function buildSidePreview(
    thresholdStr: string,
    reward: string,
    vk: BananoVoucherRewardKind,
    vPct: string,
    vEu: string,
    vDays: string,
    vWa: boolean
  ): LoyaltyProgramSideConfig {
    return {
      threshold: Math.max(1, parseInt(thresholdStr, 10) || 1),
      rewardText: reward,
      voucherRewardKind: vk,
      voucherRewardPercent: vk === 'percent' ? parseRatePerEuro(vPct) : 0,
      voucherRewardEuroCents:
        vk === 'fixed_euro'
          ? Math.round(Math.max(0, parseRatePerEuro(vEu)) * 100)
          : 0,
      voucherValidityDays: (() => {
        const t = vDays.trim();
        if (!t) return null;
        const n = Math.floor(parseInt(t, 10));
        return Number.isFinite(n) && n >= 1 ? n : null;
      })(),
      voucherWhatsAppEnabled: vWa,
    };
  }

  const previewCfg = useMemo(
    (): BananoLoyaltyMerchantConfig => ({
      bananoPilotageIngestSecret: loyalty.bananoPilotageIngestSecret,
      mode: programMode,
      pointsProgram: buildSidePreview(
        thresholdPoints,
        rewardTextPoints,
        voucherPointsKind,
        voucherPointsPercent,
        voucherPointsEuros,
        voucherPointsValidityDays,
        voucherPointsWhatsApp
      ),
      stampsProgram: buildSidePreview(
        thresholdStamps,
        rewardTextStamps,
        voucherStampsKind,
        voucherStampsPercent,
        voucherStampsEuros,
        voucherStampsValidityDays,
        voucherStampsWhatsApp
      ),
      pointsPerVisit: 0,
      pointsPerEuro: parseRatePerEuro(pointsPerEuro),
      stampsPerVisit: Math.min(10_000, parseNonNegInt(stampsPerVisit, 0)),
      stampsPerEuro: parseRatePerEuro(stampsPerEuro),
      bonus: {
        enabled: bonusEnabled,
        startDate: bonusStart.trim() || null,
        endDate: bonusEnd.trim() || null,
        pointsExtraPerVisit: 0,
        stampsExtraPerVisit: 0,
        pointsExtraPerEuro: parseRatePerEuro(bonusPointsPerEuro),
        stampsExtraPerEuro: parseRatePerEuro(bonusStampsPerEuro),
      },
      staffAllowance: loyalty.staffAllowance,
      eliteReward: loyalty.eliteReward,
      signupWelcome: {
        enabled: signupWelcomeEnabled,
        voucherRewardKind: signupWelcomeKind,
        voucherRewardPercent:
          signupWelcomeKind === 'percent' ? parseRatePerEuro(signupWelcomePercent) : 0,
        voucherRewardEuroCents:
          signupWelcomeKind === 'fixed_euro'
            ? Math.round(Math.max(0, parseRatePerEuro(signupWelcomeEuros)) * 100)
            : 0,
        rewardLabel: signupWelcomeLabel.trim(),
        validityDays: (() => {
          const s = signupWelcomeValidityDays.trim();
          if (!s) return null;
          const n = Math.floor(parseInt(s, 10));
          return Number.isFinite(n) && n >= 1 ? n : null;
        })(),
      },
    }),
    [
      loyalty.bananoPilotageIngestSecret,
      loyalty.staffAllowance,
      loyalty.eliteReward,
      signupWelcomeEnabled,
      signupWelcomeKind,
      signupWelcomePercent,
      signupWelcomeEuros,
      signupWelcomeLabel,
      signupWelcomeValidityDays,
      programMode,
      thresholdPoints,
      thresholdStamps,
      rewardTextPoints,
      rewardTextStamps,
      voucherPointsKind,
      voucherPointsPercent,
      voucherPointsEuros,
      voucherPointsValidityDays,
      voucherPointsWhatsApp,
      voucherStampsKind,
      voucherStampsPercent,
      voucherStampsEuros,
      voucherStampsValidityDays,
      voucherStampsWhatsApp,
      pointsPerEuro,
      stampsPerVisit,
      stampsPerEuro,
      bonusEnabled,
      bonusStart,
      bonusEnd,
      bonusPointsPerEuro,
      bonusStampsPerEuro,
    ]
  );

  const bonusPerEuroLiveToday = isBonusPerEuroStackingActive(previewCfg.bonus, programMode);

  const earnIfStampsFallback = effectiveEarnCredit({
    mode: 'stamps',
    pointsPerVisit: 0,
    stampsPerVisit: previewCfg.stampsPerVisit,
    bonus: previewCfg.bonus,
  });

  function applyPreset(presetId: (typeof BONUS_PRESET_IDS)[number]) {
    const y = new Date().getFullYear();
    const { start, end } = BONUS_PRESET_RANGES[presetId](y);
    setBonusEnabled(true);
    setBonusStart(start);
    setBonusEnd(end);
    toast.message(
      t('toastPresetApplied', { label: t(`preset_${presetId}`), start, end })
    );
  }

  function applyUserPreset(u: UserBonusPreset) {
    setBonusEnabled(true);
    setBonusStart(u.start);
    setBonusEnd(u.end);
    toast.message(t('toastUserPresetApplied', { label: u.label || t('defaultEventLabel') }));
  }

  function addCustomPreset() {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `u-${Date.now()}`;
    const y = new Date().getFullYear();
    const start = `${y}-06-01`;
    const end = `${y}-06-07`;
    const label = t('defaultMyEvent');
    const next = [...userPresets, { id, label, start, end }];
    persistUserPresets(next);
    setBonusEnabled(true);
    setBonusStart(start);
    setBonusEnd(end);
    setPresetEditor({ scope: 'user', id, label, start, end });
    toast.message(t('toastCustomCreated'));
  }

  function applyPresetEditor() {
    if (!presetEditor) return;
    if (presetEditor.start > presetEditor.end) {
      toast.error(t('toastEndAfterStart'));
      return;
    }
    setBonusStart(presetEditor.start);
    setBonusEnd(presetEditor.end);
    setBonusEnabled(true);
    if (presetEditor.scope === 'user') {
      const trimmed = presetEditor.label.trim() || t('defaultMyEvent');
      const next = userPresets.map((u) =>
        u.id === presetEditor.id ? { ...u, label: trimmed, start: presetEditor.start, end: presetEditor.end } : u
      );
      persistUserPresets(next);
    }
    setPresetEditor(null);
    toast.success(t('toastBonusDatesSaved'));
  }

  function deleteUserPreset(id: string) {
    const next = userPresets.filter((u) => u.id !== id);
    persistUserPresets(next);
    if (presetEditor?.scope === 'user' && presetEditor.id === id) setPresetEditor(null);
    toast.message(t('toastEventDeleted'));
  }

  function validateVoucherSide(
    ctx: 'voucherCtxPoints' | 'voucherCtxStamps',
    vk: BananoVoucherRewardKind,
    vPct: string,
    vEu: string
  ): boolean {
    if (vk === 'percent') {
      const vp = parseRatePerEuro(vPct);
      if (!(vp > 0) || vp > 100) {
        toast.error(t('errVoucherPercent', { context: t(ctx) }));
        return false;
      }
    }
    if (vk === 'fixed_euro') {
      const e = parseRatePerEuro(vEu);
      const cents = Math.round(e * 100);
      if (cents < 1) {
        toast.error(t('errVoucherEuro', { context: t(ctx) }));
        return false;
      }
    }
    return true;
  }

  async function activateCashSync() {
    const secret = nanoid(32);
    setCashSyncBusy(true);
    try {
      const res = await fetch('/api/banano/loyalty/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pilotageIngestSecret: secret }),
      });
      const data = (await res.json()) as { loyalty?: BananoLoyaltyMerchantConfig; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      if (data.loyalty) {
        onSaved(data.loyalty);
        toast.success(t('cashSyncActivatedToast'));
        await onRefreshBootstrap?.();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setCashSyncBusy(false);
    }
  }

  async function copyCashSyncSecret() {
    const v = loyalty.bananoPilotageIngestSecret;
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      toast.success(t('cashSyncCopyToast'));
    } catch {
      toast.error(t('cashSyncCopyErr'));
    }
  }

  async function save() {
    const tPts = Math.floor(parseInt(thresholdPoints, 10));
    const tSt = Math.floor(parseInt(thresholdStamps, 10));
    const ppe = parseRatePerEuro(pointsPerEuro);
    const spe = parseRatePerEuro(stampsPerEuro);
    const st = Math.floor(parseInt(stampsPerVisit, 10));
    const pExE = parseRatePerEuro(bonusPointsPerEuro);
    const sExE = parseRatePerEuro(bonusStampsPerEuro);

    if (!Number.isFinite(tPts) || tPts < 1) {
      toast.error(t('errThresholdPoints'));
      return;
    }
    if (!Number.isFinite(tSt) || tSt < 1) {
      toast.error(t('errThresholdStamps'));
      return;
    }

    if (!Number.isFinite(ppe) || ppe <= 0) {
      toast.error(t('errPointsPerEuro'));
      return;
    }

    if ((!Number.isFinite(spe) || spe <= 0) && (!Number.isFinite(st) || st <= 0)) {
      toast.error(t('errStampsProgram'));
      return;
    }

    if (!Number.isFinite(st) || st < 0 || st > 10_000) {
      toast.error(t('errStampsFlat'));
      return;
    }

    const rewardPts = rewardTextPoints.trim();
    const rewardSt = rewardTextStamps.trim();
    if (rewardPts.length < 1 || rewardPts.length > 2000) {
      toast.error(t('errRewardPtsLen'));
      return;
    }
    if (rewardSt.length < 1 || rewardSt.length > 2000) {
      toast.error(t('errRewardStLen'));
      return;
    }

    if (!bonusEnabled && programMode === 'points' && pExE > 0) {
      toast.error(t('errBonusPointsNeedEnable'));
      return;
    }
    if (!bonusEnabled && programMode === 'stamps' && sExE > 0) {
      toast.error(t('errBonusStampsNeedEnable'));
      return;
    }

    if (bonusEnabled) {
      if (!bonusStart.trim() || !bonusEnd.trim()) {
        toast.error(t('errBonusNeedDates'));
        return;
      }
      if (bonusStart > bonusEnd) {
        toast.error(t('errBonusEndBeforeStart'));
        return;
      }
      if (programMode === 'points' && !(pExE > 0)) {
        toast.error(t('errBonusPointsPerEuro'));
        return;
      }
      if (programMode === 'stamps' && !(sExE > 0)) {
        toast.error(t('errBonusStampsPerEuro'));
        return;
      }
    }

    if (!validateVoucherSide('voucherCtxPoints', voucherPointsKind, voucherPointsPercent, voucherPointsEuros)) {
      return;
    }
    if (!validateVoucherSide('voucherCtxStamps', voucherStampsKind, voucherStampsPercent, voucherStampsEuros)) {
      return;
    }

    if (signupWelcomeEnabled) {
      if (signupWelcomeKind === 'percent') {
        const p = parseRatePerEuro(signupWelcomePercent);
        if (!(p > 0) || p > 100) {
          toast.error(t('errSignupWelcomePercent'));
          return;
        }
      }
      if (signupWelcomeKind === 'fixed_euro') {
        const e = parseRatePerEuro(signupWelcomeEuros);
        if (Math.round(Math.max(0, e) * 100) < 1) {
          toast.error(t('errSignupWelcomeEuro'));
          return;
        }
      }
    }

    function parseVoucherDays(raw: string): number | null {
      const s = raw.trim();
      if (!s) return null;
      const n = Math.floor(parseInt(s, 10));
      if (!Number.isFinite(n) || n < 1 || n > 3650) return -1;
      return n;
    }
    const vdPts = parseVoucherDays(voucherPointsValidityDays);
    const vdSt = parseVoucherDays(voucherStampsValidityDays);
    if (vdPts === -1 || vdSt === -1) {
      toast.error(t('errVoucherValidity'));
      return;
    }
    const vdSignup = parseVoucherDays(signupWelcomeValidityDays);
    if (vdSignup === -1) {
      toast.error(t('errVoucherValidity'));
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        loyaltyMode: programMode,
        threshold: tPts,
        rewardText: rewardPts,
        thresholdStamps: tSt,
        rewardTextStamps: rewardSt,
        pointsPerVisit: 0,
        pointsPerEuro: ppe,
        stampsPerVisit: st,
        stampsPerEuro: spe,
        bonusEnabled,
        bonusStartDate: bonusEnabled ? bonusStart.trim() : null,
        bonusEndDate: bonusEnabled ? bonusEnd.trim() : null,
        bonusPointsExtra: 0,
        bonusStampsExtra: 0,
        bonusPointsPerEuro: bonusEnabled && programMode === 'points' ? Math.min(100_000, Math.max(0, pExE)) : 0,
        bonusStampsPerEuro: bonusEnabled && programMode === 'stamps' ? Math.min(100_000, Math.max(0, sExE)) : 0,
        voucherRewardKind: voucherPointsKind,
        voucherRewardPercent:
          voucherPointsKind === 'percent' ? parseRatePerEuro(voucherPointsPercent) : 0,
        voucherRewardEuroCents:
          voucherPointsKind === 'fixed_euro'
            ? Math.round(Math.max(0, parseRatePerEuro(voucherPointsEuros)) * 100)
            : 0,
        voucherValidityDays: vdPts,
        voucherWhatsAppEnabled: voucherPointsWhatsApp,
        voucherStampsRewardKind: voucherStampsKind,
        voucherStampsRewardPercent:
          voucherStampsKind === 'percent' ? parseRatePerEuro(voucherStampsPercent) : 0,
        voucherStampsRewardEuroCents:
          voucherStampsKind === 'fixed_euro'
            ? Math.round(Math.max(0, parseRatePerEuro(voucherStampsEuros)) * 100)
            : 0,
        voucherStampsValidityDays: vdSt,
        voucherStampsWhatsAppEnabled: voucherStampsWhatsApp,
        signupWelcomeEnabled,
        signupWelcomeRewardKind: signupWelcomeKind,
        signupWelcomeRewardPercent:
          signupWelcomeKind === 'percent' ? parseRatePerEuro(signupWelcomePercent) : 0,
        signupWelcomeRewardEuroCents:
          signupWelcomeKind === 'fixed_euro'
            ? Math.round(Math.max(0, parseRatePerEuro(signupWelcomeEuros)) * 100)
            : 0,
        signupWelcomeRewardLabel: signupWelcomeLabel.trim(),
        signupWelcomeValidityDays: vdSignup,
      };

      const res = await fetch('/api/banano/loyalty/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { loyalty?: BananoLoyaltyMerchantConfig; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      if (data.loyalty) {
        onSaved(data.loyalty);
        setProgramMode(data.loyalty.mode);
        setThresholdPoints(String(data.loyalty.pointsProgram.threshold));
        setThresholdStamps(String(data.loyalty.stampsProgram.threshold));
        setRewardTextPoints(data.loyalty.pointsProgram.rewardText);
        setRewardTextStamps(data.loyalty.stampsProgram.rewardText);
        setPointsPerEuro(data.loyalty.pointsPerEuro === 0 ? '' : String(data.loyalty.pointsPerEuro));
        setStampsPerVisit(String(data.loyalty.stampsPerVisit));
        setStampsPerEuro(data.loyalty.stampsPerEuro === 0 ? '' : String(data.loyalty.stampsPerEuro));
        setBonusEnabled(data.loyalty.bonus.enabled);
        setBonusStart(data.loyalty.bonus.startDate ?? '');
        setBonusEnd(data.loyalty.bonus.endDate ?? '');
        setBonusPointsPerEuro(
          data.loyalty.bonus.pointsExtraPerEuro > 0 ? String(data.loyalty.bonus.pointsExtraPerEuro) : ''
        );
        setBonusStampsPerEuro(
          data.loyalty.bonus.stampsExtraPerEuro > 0 ? String(data.loyalty.bonus.stampsExtraPerEuro) : ''
        );
        hydrateVoucherFields(data.loyalty.pointsProgram, 'points');
        hydrateVoucherFields(data.loyalty.stampsProgram, 'stamps');
        setSignupWelcomeEnabled(data.loyalty.signupWelcome.enabled);
        setSignupWelcomeKind(data.loyalty.signupWelcome.voucherRewardKind);
        setSignupWelcomePercent(
          data.loyalty.signupWelcome.voucherRewardKind === 'percent' &&
            data.loyalty.signupWelcome.voucherRewardPercent > 0
            ? String(data.loyalty.signupWelcome.voucherRewardPercent)
            : ''
        );
        setSignupWelcomeEuros(
          data.loyalty.signupWelcome.voucherRewardKind === 'fixed_euro' &&
            data.loyalty.signupWelcome.voucherRewardEuroCents > 0
            ? String(data.loyalty.signupWelcome.voucherRewardEuroCents / 100)
            : ''
        );
        setSignupWelcomeLabel(data.loyalty.signupWelcome.rewardLabel);
        setSignupWelcomeValidityDays(
          data.loyalty.signupWelcome.validityDays != null
            ? String(data.loyalty.signupWelcome.validityDays)
            : ''
        );
        toast.success(t('toastSavedSuccess'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const ppeN = parseRatePerEuro(pointsPerEuro);
  const speN = parseRatePerEuro(stampsPerEuro);
  const thrPointsN = Math.max(1, Math.floor(parseInt(thresholdPoints, 10) || 1));
  const thrStampsN = Math.max(1, Math.floor(parseInt(thresholdStamps, 10) || 1));
  const bonusPtsN = parseRatePerEuro(bonusPointsPerEuro);
  const bonusStN = parseRatePerEuro(bonusStampsPerEuro);
  const stFlat = parseNonNegInt(stampsPerVisit, 0);
  const bonusDatesOk =
    bonusEnabled && bonusStart.trim().length > 0 && bonusEnd.trim().length > 0 && bonusStart <= bonusEnd;
  const showPointsBonusRecap = programMode === 'points' && bonusDatesOk && bonusPtsN > 0;
  const showStampsBonusRecap =
    programMode === 'stamps' && bonusDatesOk && bonusStN > 0 && Number.isFinite(speN) && speN > 0;

  /** Bon QR / code : champs séparés pour le programme points et pour le programme tampons. */
  function renderVoucherAtThresholdBlock(side: 'points' | 'stamps') {
    const unitLower = t(side === 'points' ? 'unitPointsLower' : 'unitStampsLower');
    const unitCap = t(side === 'points' ? 'unitPointsCap' : 'unitStampsCap');
    const kind = side === 'points' ? voucherPointsKind : voucherStampsKind;
    const setKind = side === 'points' ? setVoucherPointsKind : setVoucherStampsKind;
    const pct = side === 'points' ? voucherPointsPercent : voucherStampsPercent;
    const setPct = side === 'points' ? setVoucherPointsPercent : setVoucherStampsPercent;
    const eu = side === 'points' ? voucherPointsEuros : voucherStampsEuros;
    const setEu = side === 'points' ? setVoucherPointsEuros : setVoucherStampsEuros;
    const vd = side === 'points' ? voucherPointsValidityDays : voucherStampsValidityDays;
    const setVd = side === 'points' ? setVoucherPointsValidityDays : setVoucherStampsValidityDays;
    const wa = side === 'points' ? voucherPointsWhatsApp : voucherStampsWhatsApp;
    const setWa = side === 'points' ? setVoucherPointsWhatsApp : setVoucherStampsWhatsApp;
    return (
      <div className="sm:col-span-2 rounded-xl border border-amber-200/70 dark:border-amber-800/45 bg-amber-50/35 dark:bg-amber-950/20 p-3 space-y-3">
        <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">
          {t('voucherTitle', { unit: unitCap })}
        </p>
        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
          {t('voucherIntro', { unit: unitLower })}
        </p>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            {t('voucherNatureLabel')}
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as BananoVoucherRewardKind)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          >
            <option value="label_only">{t('optLabelOnly')}</option>
            <option value="percent">{t('optPercentLabel')}</option>
            <option value="fixed_euro">{t('optFixedEuro')}</option>
          </select>
        </div>
        {kind === 'percent' ? (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('pctOnVoucherLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={pct}
              onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 12))}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
        ) : null}
        {kind === 'fixed_euro' ? (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('euroAmountLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={eu}
              onChange={(e) => setEu(e.target.value.replace(/[^\d.,]/g, '').slice(0, 24))}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
        ) : null}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            {t('validityDaysLabel')}
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            placeholder={t('validityPlaceholder')}
            value={vd}
            onChange={(e) => setVd(e.target.value)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 rounded border-slate-300"
            checked={wa}
            onChange={(e) => setWa(e.target.checked)}
          />
          <span className="text-[11px] text-slate-700 dark:text-slate-200 leading-snug">
            {t('whatsappCheckbox')}
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#2563eb]/35 bg-blue-50/90 dark:bg-[#2563eb]/10 p-3 sm:p-4 mb-6 space-y-5">
      <div className="rounded-xl border border-emerald-200/90 dark:border-emerald-900/45 bg-white/85 dark:bg-zinc-900/45 p-3 sm:p-4 space-y-3 shadow-sm shadow-black/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
          <span>{t('cashSyncSectionTitle')}</span>
        </div>
        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
          {t('cashSyncSectionLead')}
        </p>
        {!loyalty.bananoPilotageIngestSecret ? (
          <button
            type="button"
            disabled={cashSyncBusy}
            onClick={() => void activateCashSync()}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold shadow-sm"
          >
            {cashSyncBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
            {cashSyncBusy ? t('cashSyncActivating') : t('cashSyncActivate')}
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t('cashSyncSecretLabel')}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={loyalty.bananoPilotageIngestSecret}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm font-mono text-slate-800 dark:text-slate-100"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void copyCashSyncSecret()}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:border-emerald-500/50"
              >
                <Copy className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
                {t('cashSyncCopy')}
              </button>
            </div>
            <a
              href={REPUTEXA_SYNC_WINDOWS_URL || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!REPUTEXA_SYNC_WINDOWS_URL) {
                  e.preventDefault();
                  toast.message(t('cashSyncDownloadPlaceholderToast'));
                }
              }}
              className="inline-flex items-center justify-center min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-zinc-600 bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800/80"
            >
              {t('cashSyncDownloadWindows')}
            </a>
            {cashSyncLive === null ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                {t('cashSyncStatusChecking')}
              </p>
            ) : (
              <p
                className={`text-xs font-semibold ${
                  cashSyncLive
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
                aria-label={
                  cashSyncLive ? t('cashSyncStatusAriaActive') : t('cashSyncStatusAriaIdle')
                }
              >
                {cashSyncLive &&
                cashSyncTerminalCount != null &&
                cashSyncTerminalCount > 0 ? (
                  t('cashSyncStatusActiveWithTerminals', { count: cashSyncTerminalCount })
                ) : cashSyncLive ? (
                  t('cashSyncStatusActive')
                ) : (
                  t('cashSyncStatusIdle')
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Settings2 className="w-4 h-4 text-[#2563eb] shrink-0" />
        <span>{t('settingsCardTitle')}</span>
      </div>

      <div className="rounded-xl border border-[#2563eb]/20 dark:border-[#2563eb]/35 bg-white/70 dark:bg-zinc-900/50 p-3">
        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-2">{t('modeActiveLabel')}</p>
        <div className="flex rounded-xl border border-slate-200 dark:border-zinc-700 p-1 bg-slate-50 dark:bg-zinc-900 max-w-md">
          <button
            type="button"
            onClick={() => setProgramMode('points')}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold min-h-[44px] transition-colors ${
              programMode === 'points'
                ? 'bg-white dark:bg-zinc-800 shadow text-[#2563eb]'
                : 'text-slate-500'
            }`}
          >
            {t('modePoints')}
          </button>
          <button
            type="button"
            onClick={() => setProgramMode('stamps')}
            className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold min-h-[44px] transition-colors ${
              programMode === 'stamps'
                ? 'bg-white dark:bg-zinc-800 shadow text-[#2563eb]'
                : 'text-slate-500'
            }`}
          >
            {t('modeStamps')}
          </button>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          {programMode === 'points' ? t('modePointsHelp') : t('modeStampsHelp')}
        </p>
      </div>

      {programMode === 'points' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200/90 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/30 p-3 space-y-3">
          <p className="sm:col-span-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
            {t('programPointsTitle')}
          </p>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('goalPointsLabel')}
            </label>
            <input
              type="number"
              min={1}
              value={thresholdPoints}
              onChange={(e) => setThresholdPoints(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('rewardLabelPoints')}
            </label>
            <input
              type="text"
              value={rewardTextPoints}
              maxLength={2000}
              onChange={(e) => setRewardTextPoints(e.target.value)}
              placeholder={t('rewardPlaceholderPoints')}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          {renderVoucherAtThresholdBlock(VOUCHER_AT_THRESHOLD_SIDE_POINTS)}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('creditPointsLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={pointsPerEuro}
              onChange={(e) =>
                setPointsPerEuro(e.target.value.replace(/[^\d.,]/g, '').slice(0, 24))
              }
              placeholder={t('creditPlaceholder')}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200/90 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/30 p-3 space-y-3">
          <p className="sm:col-span-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
            {t('programStampsTitle')}
          </p>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('goalStampsLabel')}
            </label>
            <input
              type="number"
              min={1}
              value={thresholdStamps}
              onChange={(e) => setThresholdStamps(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('rewardLabelStamps')}
            </label>
            <input
              type="text"
              value={rewardTextStamps}
              maxLength={2000}
              onChange={(e) => setRewardTextStamps(e.target.value)}
              placeholder={t('rewardPlaceholderStamps')}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          {renderVoucherAtThresholdBlock(VOUCHER_AT_THRESHOLD_SIDE_STAMPS)}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('stampsPerEuroLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={stampsPerEuro}
              onChange={(e) =>
                setStampsPerEuro(e.target.value.replace(/[^\d.,]/g, '').slice(0, 24))
              }
              placeholder={t('stampsPerEuroPlaceholder')}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {t('stampsPerEuroHelpA')} <strong>{t('stampsPerEuroHelpStrong')}</strong> {t('stampsPerEuroHelpB')}{' '}
              {t('stampsPerEuroHelpC', {
                count: Math.ceil(25 * (speN || 0.1)),
              })}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('stampsFlatLabel')}
            </label>
            <input
              type="number"
              min={0}
              max={10_000}
              value={stampsPerVisit}
              onChange={(e) => setStampsPerVisit(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
        </div>
      )}

      {programMode === 'points' && ppeN > 0 ? (
        <div className="rounded-xl border border-emerald-200/90 dark:border-emerald-900/45 bg-emerald-50/75 dark:bg-emerald-950/25 px-3 py-3 space-y-2">
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {t('recapCashTitle')}
          </p>
          <p className="text-[10px] text-emerald-900/80 dark:text-emerald-300/85">{t('recapCashSubtitle')}</p>
          <ul className="text-[11px] text-emerald-950/92 dark:text-emerald-100/88 space-y-2 pl-4 list-disc marker:text-emerald-600 dark:marker:text-emerald-500">
            <li>
              {t('recapRewardLine', {
                reward: t('recapRewardBold'),
                threshold: thrPointsN,
                text: rewardTextPoints.trim() || '…',
              })}
            </li>
            <li>
              <span className="font-semibold">{t('recapOffBonusTitle')}</span>{' '}
              {t('recapOffBonusRest', {
                rate: ppeN,
                exA: Math.ceil(1.2 * ppeN),
                exB: Math.ceil(50.01 * ppeN),
              })}
            </li>
            {showPointsBonusRecap ? (
              <li>
                <span className="font-semibold">
                  {t('recapBonusPeriod', {
                    start: formatYmd(bonusStart),
                    end: formatYmd(bonusEnd),
                    rate: ppeN + bonusPtsN,
                    base: ppeN,
                    bonus: bonusPtsN,
                    exA: Math.ceil(1.2 * (ppeN + bonusPtsN)),
                    exB: Math.ceil(50.01 * (ppeN + bonusPtsN)),
                  })}
                </span>
              </li>
            ) : bonusEnabled && programMode === 'points' ? (
              <li className="list-none -ml-4 text-[10px] text-emerald-800/85 dark:text-emerald-300/80">
                {t('recapBonusHintIncomplete')}
              </li>
            ) : null}
          </ul>
        </div>
      ) : programMode === 'stamps' ? (
        <div className="rounded-xl border border-emerald-200/90 dark:border-emerald-900/45 bg-emerald-50/75 dark:bg-emerald-950/25 px-3 py-3 space-y-2">
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {t('recapStampsTitle')}
          </p>
          <ul className="text-[11px] text-emerald-950/92 dark:text-emerald-100/88 space-y-2 pl-4 list-disc marker:text-emerald-600 dark:marker:text-emerald-500">
            <li>
              {t('recapStampsCardLine', {
                carte: t('recapStampsCarteBold'),
                threshold: thrStampsN,
                bon: t('recapStampsBon'),
              })}
            </li>
            <li>
              {t('recapStampsDisplayLine', {
                affichage: t('recapStampsAffichageBold'),
                text: rewardTextStamps.trim() || '…',
              })}
            </li>
            {speN > 0 ? (
              <>
                <li>
                  {t('recapOffBonusStamps', {
                    title: t('recapOffBonusStampsTitle'),
                    rate: t('recapStampPerEuro', { n: speN }),
                    ex: Math.ceil(24.9 * speN),
                  })}
                  {stFlat > 0 ? (
                    <>
                      {' '}
                      {t('recapFlatPlus', { n: stFlat })}
                    </>
                  ) : null}
                  .
                </li>
                {showStampsBonusRecap ? (
                  <li>
                    <span className="font-semibold">
                      {t('recapBonusStampsLine', {
                        start: formatYmd(bonusStart),
                        end: formatYmd(bonusEnd),
                        rate: t('recapStampPerEuro', { n: speN + bonusStN }),
                        ex: Math.ceil(24.9 * (speN + bonusStN)),
                        flat:
                          stFlat > 0
                            ? ` ${t('recapFlatShort', { n: stFlat })}`
                            : '',
                      })}
                    </span>
                  </li>
                ) : bonusEnabled && speN > 0 ? (
                  <li className="list-none -ml-4 text-[10px] text-emerald-800/85 dark:text-emerald-300/80">
                    {t('recapStampsBonusHint')}
                  </li>
                ) : null}
              </>
            ) : stFlat > 0 ? (
              <li>
                {t('recapFlatOnlyLine', {
                  forfait: t('recapFlatOnlyBold'),
                  n: stFlat,
                })}{' '}
              </li>
            ) : (
              <li className="text-amber-800 dark:text-amber-300/90">{t('recapDefineRateOrFlat')}</li>
            )}
          </ul>
        </div>
      ) : null}

      <details className="group rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 open:shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-amber-900 dark:text-amber-200/95">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span className="min-w-0 flex-1">{t('bonusDetailsTitle')}</span>
          <ChevronDown className="w-4 h-4 shrink-0 text-amber-700/80 transition-transform group-open:rotate-180" />
        </summary>

        <div className="border-t border-amber-200/60 dark:border-amber-900/35 px-3 pb-3 pt-2 space-y-3">
          <p className="text-[10px] text-amber-900/85 dark:text-amber-200/80 leading-relaxed">
            {t('bonusDetailsLead', {
              strong: t('bonusDetailsStrong'),
              rate2: `2 ${t('ptsAbbr')}/€`,
            })}
          </p>

          {loyalty.bonus.pointsExtraPerVisit > 0 && loyalty.bonus.pointsExtraPerEuro <= 0 && programMode === 'points' ? (
            <p className="text-[10px] rounded-lg border border-amber-300/60 dark:border-amber-800/50 bg-amber-100/40 dark:bg-amber-950/40 px-2 py-1.5 text-amber-950 dark:text-amber-100">
              {t('legacyFlatWarning', { n: loyalty.bonus.pointsExtraPerVisit })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-semibold text-amber-900 dark:text-amber-200 w-full">
              {t('periodsTypicalTitle')}{' '}
              <span className="font-normal opacity-90">{t('periodsTypicalHint')}</span>
            </span>
            {BONUS_PRESET_IDS.map((presetId) => {
              const y = new Date().getFullYear();
              const { start, end } = BONUS_PRESET_RANGES[presetId](y);
              return (
                <button
                  key={presetId}
                  type="button"
                  title={t('presetDblClickTitle')}
                  onClick={() => applyPreset(presetId)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setPresetEditor({
                      scope: 'builtin',
                      id: presetId,
                      label: t(`preset_${presetId}`),
                      start,
                      end,
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-amber-300/80 dark:border-amber-800 bg-white/80 dark:bg-zinc-900 text-amber-950 dark:text-amber-100 hover:bg-amber-100/80 dark:hover:bg-amber-950/40"
                >
                  {t(`preset_${presetId}`)}
                </button>
              );
            })}
            {userPresets.map((u) => (
              <button
                key={u.id}
                type="button"
                title={t('userPresetDblClickTitle')}
                onClick={() => applyUserPreset(u)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  setPresetEditor({
                    scope: 'user',
                    id: u.id,
                    label: u.label || t('defaultEventLabel'),
                    start: u.start,
                    end: u.end,
                  });
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-violet-300/80 dark:border-violet-800 bg-violet-50/90 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100 hover:opacity-90"
              >
                {u.label || t('defaultEventLabel')}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addCustomPreset()}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-dashed border-amber-400/90 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-950/50"
            >
              {t('addCustomEventButton')}
            </button>
          </div>

          {presetEditor ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-white/90 dark:bg-zinc-900/80 p-3 space-y-2.5">
              <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-100">
                {presetEditor.scope === 'builtin'
                  ? t('editorAdjustBuiltin', {
                      label: (BONUS_PRESET_IDS as readonly string[]).includes(presetEditor.id)
                        ? t(
                            `preset_${presetEditor.id}` as
                              | 'preset_noel'
                              | 'preset_nouvel_an'
                              | 'preset_st_valentin'
                              | 'preset_ete'
                          )
                        : presetEditor.label,
                    })
                  : t('editorCustomEvent')}
              </p>
              {presetEditor.scope === 'user' ? (
                <label className="block text-[11px] text-slate-600 dark:text-slate-400">
                  {t('buttonNameLabel')}
                  <input
                    type="text"
                    value={presetEditor.label}
                    onChange={(e) => setPresetEditor((d) => (d ? { ...d, label: e.target.value } : d))}
                    className="mt-1 w-full min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t('dateStartLabel')}
                  <input
                    type="date"
                    value={presetEditor.start}
                    onChange={(e) => setPresetEditor((d) => (d ? { ...d, start: e.target.value } : d))}
                    className="mt-1 w-full min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
                <label className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t('dateEndLabel')}
                  <input
                    type="date"
                    value={presetEditor.end}
                    onChange={(e) => setPresetEditor((d) => (d ? { ...d, end: e.target.value } : d))}
                    className="mt-1 w-full min-h-[38px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPresetEditor()}
                  className="min-h-[40px] px-3 rounded-lg bg-[#2563eb] text-white text-xs font-semibold hover:bg-[#1d4ed8]"
                >
                  {t('applyBonus')}
                </button>
                <button
                  type="button"
                  onClick={() => setPresetEditor(null)}
                  className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-zinc-600 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {t('close')}
                </button>
                {presetEditor.scope === 'user' ? (
                  <button
                    type="button"
                    onClick={() => deleteUserPreset(presetEditor.id)}
                    className="min-h-[40px] px-3 rounded-lg border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
                  >
                    {t('deleteEvent')}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer">
            <input
              type="checkbox"
              checked={bonusEnabled}
              onChange={(e) => setBonusEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            {t('enableBonusCheckbox')}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                {t('bonusStartInclusive')}
              </label>
              <input
                type="date"
                value={bonusStart}
                onChange={(e) => setBonusStart(e.target.value)}
                disabled={!bonusEnabled}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                {t('bonusEndInclusive')}
              </label>
              <input
                type="date"
                value={bonusEnd}
                onChange={(e) => setBonusEnd(e.target.value)}
                disabled={!bonusEnabled}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
              />
            </div>
            {programMode === 'points' ? (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {t('bonusPointsPerEuroLabel')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={bonusPointsPerEuro}
                  onChange={(e) =>
                    setBonusPointsPerEuro(e.target.value.replace(/[^\d.,]/g, '').slice(0, 24))
                  }
                  disabled={!bonusEnabled}
                  placeholder={t('bonusPointsPlaceholder')}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
                />
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {t('bonusStampsPerEuroLabel')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={bonusStampsPerEuro}
                  onChange={(e) =>
                    setBonusStampsPerEuro(e.target.value.replace(/[^\d.,]/g, '').slice(0, 24))
                  }
                  disabled={!bonusEnabled}
                  placeholder={t('bonusStampsPlaceholder')}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200/80 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/50 px-2.5 py-2 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
            {programMode === 'points' && ppeN > 0 ? (
              <>
                <p>
                  <span className="font-semibold">{t('todayParisPrefix')}</span> ·{' '}
                  <span suppressHydrationWarning className="inline">
                    {todayParisLabel}
                  </span>{' '}
                  :{' '}
                  {bonusPerEuroLiveToday && showPointsBonusRecap ? (
                    <>
                      {t('bonusWord')}{' '}
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {t('bonusActive')}
                      </span>{' '}
                      →{' '}
                      <strong>
                        {ppeN + bonusPtsN} {t('ptsAbbr')}/{'\u20ac'}
                      </strong>{' '}
                      {t('seeGreenRecapExamples')}
                    </>
                  ) : (
                    <>
                      <strong>
                        {ppeN} {t('ptsAbbr')}/{'\u20ac'}
                      </strong>{' '}
                      {t('todayBaseOnly')}
                      {showPointsBonusRecap && !bonusPerEuroLiveToday
                        ? ` ${t('todayOutsideWindow')}`
                        : showPointsBonusRecap
                          ? ` ${t('todaySeeGreenRecap')}`
                          : null}
                    </>
                  )}
                </p>
                {showPointsBonusRecap && !bonusPerEuroLiveToday ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('todayWindowLine', {
                      start: formatYmd(bonusStart),
                      end: formatYmd(bonusEnd),
                      rate: `${ppeN} ${t('ptsAbbr')}/€`,
                      bonus: bonusPtsN,
                    })}
                  </p>
                ) : null}
              </>
            ) : programMode === 'points' ? (
              <p className="text-amber-700 dark:text-amber-400">{t('definePointsRate')}</p>
            ) : speN > 0 ? (
              <>
                <p>
                  <span className="font-semibold">{t('todayParisPrefix')}</span> ·{' '}
                  <span suppressHydrationWarning className="inline">
                    {todayParisLabel}
                  </span>{' '}
                  :{' '}
                  {bonusPerEuroLiveToday && showStampsBonusRecap ? (
                    <>
                      {t('bonusWord')}{' '}
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {t('bonusActive')}
                      </span>{' '}
                      →{' '}
                      <strong>{t('recapStampPerEuro', { n: speN + bonusStN })}</strong>.
                    </>
                  ) : (
                    <>
                      <strong>{t('recapStampPerEuro', { n: speN })}</strong>
                      {showStampsBonusRecap && !bonusPerEuroLiveToday
                        ? t('stampsTodayOutside')
                        : showStampsBonusRecap
                          ? t('stampsTodaySeeGreen')
                          : '.'}
                    </>
                  )}
                </p>
                {showStampsBonusRecap && !bonusPerEuroLiveToday ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('stampsWindowLine', {
                      start: formatYmd(bonusStart),
                      end: formatYmd(bonusEnd),
                      rate: t('recapStampPerEuro', { n: speN + bonusStN }),
                    })}
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                {t('flatPreview', {
                  flat: t('flatPreviewBold'),
                  n: earnIfStampsFallback.stamps,
                })}
              </p>
            )}
          </div>
        </div>
      </details>

      <div className="rounded-xl border border-violet-200/80 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-3">
        <p className="text-[11px] font-semibold text-violet-950 dark:text-violet-100">{t('signupWelcomeTitle')}</p>
        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">{t('signupWelcomeIntro')}</p>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 rounded border-slate-300"
            checked={signupWelcomeEnabled}
            onChange={(e) => setSignupWelcomeEnabled(e.target.checked)}
          />
          <span className="text-[11px] text-slate-700 dark:text-slate-200 leading-snug">
            {t('signupWelcomeEnable')}
          </span>
        </label>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            {t('signupWelcomeNatureLabel')}
          </label>
          <select
            value={signupWelcomeKind}
            onChange={(e) => setSignupWelcomeKind(e.target.value as BananoVoucherRewardKind)}
            disabled={!signupWelcomeEnabled}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
          >
            <option value="label_only">{t('optLabelOnly')}</option>
            <option value="percent">{t('optPercentLabel')}</option>
            <option value="fixed_euro">{t('optFixedEuro')}</option>
          </select>
        </div>
        {signupWelcomeEnabled && signupWelcomeKind === 'percent' ? (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('signupWelcomePctLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={signupWelcomePercent}
              onChange={(e) => setSignupWelcomePercent(e.target.value.replace(/[^\d.,]/g, '').slice(0, 12))}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
        ) : null}
        {signupWelcomeEnabled && signupWelcomeKind === 'fixed_euro' ? (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('signupWelcomeEuroLabel')}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={signupWelcomeEuros}
              onChange={(e) => setSignupWelcomeEuros(e.target.value.replace(/[^\d.,]/g, '').slice(0, 24))}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
        ) : null}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            {t('signupWelcomeCustomLabel')}
          </label>
          <input
            type="text"
            value={signupWelcomeLabel}
            maxLength={2000}
            disabled={!signupWelcomeEnabled}
            onChange={(e) => setSignupWelcomeLabel(e.target.value)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            {t('signupWelcomeValidityLabel')}
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            placeholder={t('signupWelcomeValidityPlaceholder')}
            value={signupWelcomeValidityDays}
            disabled={!signupWelcomeEnabled}
            onChange={(e) => setSignupWelcomeValidityDays(e.target.value)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 w-full sm:w-auto"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {t('saveSettings')}
      </button>
    </div>
  );
}
