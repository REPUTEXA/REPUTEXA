'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Loader2, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  dispatchBananoStaffAllowanceSync,
  subscribeBananoStaffAllowanceSync,
} from '@/lib/banano/staff-allowance-client-sync';

function parseRatePerEuro(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return 0;
  const x = Number(t);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(100_000, x);
}

type StaffRow = {
  id: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  pin_public_code?: string | null;
  loyalty_member_id?: string | null;
  member_phone_e164?: string | null;
};

function StaffPinReset({
  staffId,
  onSaved,
}: {
  staffId: string;
  onSaved: () => void;
}) {
  const t = useTranslations('Dashboard.bananoStaffSettings');
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length !== 4) {
      toast.error(t('errPinDigits'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/banano/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: digits }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      setVal('');
      toast.success(t('toastPinUpdated'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="block text-[11px] text-slate-500 min-w-[8rem]">
        {t('newPinLabel')}
        <input
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          autoComplete="new-password"
          placeholder={t('pinInputMaskPlaceholder')}
          className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-mono tracking-widest"
        />
      </label>
      <button
        type="button"
        disabled={busy || val.replace(/\D/g, '').length !== 4}
        onClick={() => void save()}
        className="min-h-[36px] px-3 rounded-lg bg-slate-200 dark:bg-zinc-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('savePin')}
      </button>
    </div>
  );
}

type CrmHit = {
  id: string;
  display_name: string;
  phone_e164: string;
  receives_staff_allowance?: boolean;
  crm_role?: string;
};

function memberRowToHit(m: Record<string, unknown>): CrmHit {
  return {
    id: String(m.id),
    display_name: String(m.display_name ?? ''),
    phone_e164: String(m.phone_e164 ?? ''),
    receives_staff_allowance: Boolean(m.receives_staff_allowance),
    crm_role: m.crm_role != null ? String(m.crm_role) : undefined,
  };
}

type BananoStaffSettingsProps = {
  /** Après enregistrement des paramètres « bon mensuel » : recharger le bootstrap fidélité si besoin. */
  onStaffAllowanceSettingsSaved?: () => void;
};

export function BananoStaffSettings({ onStaffAllowanceSettingsSaved }: BananoStaffSettingsProps) {
  const t = useTranslations('Dashboard.bananoStaffSettings');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [pickedMember, setPickedMember] = useState<CrmHit | null>(null);
  const [pickQ, setPickQ] = useState('');
  const [pickHits, setPickHits] = useState<CrmHit[]>([]);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickFocused, setPickFocused] = useState(false);
  const [addPin, setAddPin] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; display_name: string } | null>(null);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [allowanceRecipients, setAllowanceRecipients] = useState<CrmHit[]>([]);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [memberPatchBusy, setMemberPatchBusy] = useState<string | null>(null);
  const pickBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [staffAllowanceEnabled, setStaffAllowanceEnabled] = useState(false);
  const [staffMonthlyEuros, setStaffMonthlyEuros] = useState('');
  const [staffAllowanceValidityDays, setStaffAllowanceValidityDays] = useState('');
  const [loyaltyStaffLoading, setLoyaltyStaffLoading] = useState(true);
  const [allowanceSaveBusy, setAllowanceSaveBusy] = useState(false);

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
    setDeletePhrase('');
  }, []);

  const loadLoyaltyStaff = useCallback(async () => {
    setLoyaltyStaffLoading(true);
    try {
      const res = await fetch('/api/banano/loyalty/settings');
      const data = (await res.json()) as {
        loyalty?: { staffAllowance: { enabled: boolean; monthlyEuroCents: number; validityDays: number | null } };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      const sa = data.loyalty?.staffAllowance;
      if (sa) {
        setStaffAllowanceEnabled(sa.enabled);
        setStaffMonthlyEuros(
          sa.monthlyEuroCents > 0 ? String(sa.monthlyEuroCents / 100) : ''
        );
        setStaffAllowanceValidityDays(sa.validityDays != null ? String(sa.validityDays) : '');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errLoadAllowance'));
    } finally {
      setLoyaltyStaffLoading(false);
    }
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/banano/staff');
      const data = (await res.json()) as { staff?: StaffRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      setRows(data.staff ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    void loadLoyaltyStaff();
  }, [load, loadLoyaltyStaff]);

  const loadAllowanceRecipients = useCallback(async () => {
    setAllowanceLoading(true);
    try {
      const res = await fetch('/api/banano/staff/allowance-recipients');
      const data = (await res.json()) as { members?: Record<string, unknown>[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      setAllowanceRecipients((data.members ?? []).map((m) => memberRowToHit(m)));
    } catch {
      setAllowanceRecipients([]);
    } finally {
      setAllowanceLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAllowanceRecipients();
  }, [loadAllowanceRecipients]);

  useEffect(() => {
    return subscribeBananoStaffAllowanceSync(() => {
      void loadAllowanceRecipients();
      void loadLoyaltyStaff();
    });
  }, [loadAllowanceRecipients, loadLoyaltyStaff]);

  useEffect(() => {
    const q = pickQ.trim();
    if (q.length < 2) {
      setPickHits([]);
      setPickBusy(false);
      return;
    }
    const ac = new AbortController();
    const debounceTimer = setTimeout(() => {
      void (async () => {
        setPickBusy(true);
        try {
          const res = await fetch(`/api/banano/loyalty/members?q=${encodeURIComponent(q)}`, {
            signal: ac.signal,
          });
          const data = (await res.json()) as { members?: Record<string, unknown>[]; error?: string };
          if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
          if (ac.signal.aborted) return;
          setPickHits((data.members ?? []).map((m) => memberRowToHit(m)));
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') return;
          setPickHits([]);
        } finally {
          if (!ac.signal.aborted) setPickBusy(false);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(debounceTimer);
      ac.abort();
    };
  }, [pickQ, t]);

  useEffect(() => {
    if (!pickFocused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickFocused(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickFocused]);

  function schedulePickBlur() {
    if (pickBlurTimer.current) clearTimeout(pickBlurTimer.current);
    pickBlurTimer.current = setTimeout(() => setPickFocused(false), 180);
  }

  async function saveStaffAllowanceSettings() {
    let staffValOut: number | null = null;
    if (staffAllowanceEnabled) {
      const smCents = Math.round(Math.max(0, parseRatePerEuro(staffMonthlyEuros)) * 100);
      if (smCents < 1) {
        toast.error(t('errStaffAllowanceAmount'));
        return;
      }
      const svd = staffAllowanceValidityDays.trim();
      if (svd) {
        const n = Math.floor(parseInt(svd, 10));
        if (!Number.isFinite(n) || n < 1 || n > 3650) {
          toast.error(t('errStaffAllowanceValidity'));
          return;
        }
        staffValOut = n;
      }
    }

    setAllowanceSaveBusy(true);
    try {
      const res = await fetch('/api/banano/loyalty/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffAllowanceEnabled,
          staffAllowanceMonthlyEuroCents: staffAllowanceEnabled
            ? Math.round(Math.max(0, parseRatePerEuro(staffMonthlyEuros)) * 100)
            : 0,
          staffAllowanceValidityDays: staffAllowanceEnabled ? staffValOut : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      toast.success(t('toastAllowanceSaved'));
      onStaffAllowanceSettingsSaved?.();
      await loadLoyaltyStaff();
      dispatchBananoStaffAllowanceSync({ source: 'settings' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setAllowanceSaveBusy(false);
    }
  }

  async function patchMember(
    memberId: string,
    patch: { receivesStaffAllowance?: boolean; crmRole?: 'customer' | 'staff' }
  ) {
    setMemberPatchBusy(memberId);
    try {
      const res = await fetch(`/api/banano/crm/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      toast.success(t('toastMemberUpdated'));
      await loadAllowanceRecipients();
      dispatchBananoStaffAllowanceSync({ source: 'crm_member' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setMemberPatchBusy(null);
    }
  }

  async function addStaff() {
    if (!pickedMember) {
      toast.error(t('errPickMember'));
      return;
    }
    const pin = addPin.replace(/\D/g, '').slice(0, 4);
    if (pin.length !== 4) {
      toast.error(t('errPin4'));
      return;
    }
    setAddBusy(true);
    try {
      const res = await fetch('/api/banano/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loyalty_member_id: pickedMember.id, pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      setPickedMember(null);
      setPickQ('');
      setPickHits([]);
      setAddPin('');
      toast.success(t('toastStaffAdded'));
      await load();
      await loadAllowanceRecipients();
      dispatchBananoStaffAllowanceSync({ source: 'staff_created' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setAddBusy(false);
    }
  }

  async function setActive(id: string, is_active: boolean) {
    try {
      const res = await fetch(`/api/banano/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      toast.success(is_active ? t('toastReactivated') : t('toastAccessCut'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    }
  }

  async function removeStaff(id: string) {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/banano/staff/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      closeDeleteModal();
      toast.success(t('toastStaffDeleted'));
      await load();
      await loadAllowanceRecipients();
      dispatchBananoStaffAllowanceSync({ source: 'staff_deleted' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setDeleteBusy(false);
    }
  }

  const phraseOk =
    deletePhrase.trim().toLowerCase() === t('deleteConfirmWord').trim().toLowerCase();
  const pickQueryOk = pickQ.trim().length >= 2;
  const showPickDropdown = pickFocused && pickQueryOk;
  const pickListId = 'banano-staff-pick-member';

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-[#2563eb]">
        <UserRound className="w-5 h-5" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide">
          {t('sectionTitle')}
        </h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {t.rich('sectionLead', {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>

      <div className="rounded-xl border border-violet-200/80 dark:border-violet-800/50 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-4">
        <p className="text-xs font-bold text-violet-900 dark:text-violet-100">{t('staffAllowanceTitle')}</p>

        {loyaltyStaffLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('loadingAllowance')}
          </div>
        ) : (
          <>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 rounded border-slate-300"
                checked={staffAllowanceEnabled}
                onChange={(e) => setStaffAllowanceEnabled(e.target.checked)}
              />
              <span className="text-[11px] text-slate-700 dark:text-slate-200 leading-snug">
                {t('allowanceCheckbox')}
              </span>
            </label>

            {!staffAllowanceEnabled ? (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('allowanceDisabledHint')}
              </p>
            ) : (
              <>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t.rich('allowanceEnabledLead', {
                    strong: (chunks) => (
                      <strong className="text-violet-800 dark:text-violet-300">{chunks}</strong>
                    ),
                  })}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('allowanceMonthlyLabel')}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={staffMonthlyEuros}
                      onChange={(e) =>
                        setStaffMonthlyEuros(e.target.value.replace(/[^\d.,]/g, '').slice(0, 24))
                      }
                      placeholder={t('allowancePlaceholderEuro')}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('allowanceValidityLabel')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      placeholder={t('allowancePlaceholderDays')}
                      value={staffAllowanceValidityDays}
                      onChange={(e) => setStaffAllowanceValidityDays(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={allowanceSaveBusy}
                  onClick={() => void saveStaffAllowanceSettings()}
                  className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
                >
                  {allowanceSaveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('saveAllowance')}
                </button>

                <div className="border-t border-violet-200/60 dark:border-violet-900/40 pt-3">
                  <p className="text-[11px] font-semibold text-violet-900 dark:text-violet-200 mb-1">
                    {t('recipientsTitle', { count: allowanceRecipients.length })}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">{t('recipientsHint')}</p>
                  {allowanceLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  ) : allowanceRecipients.length === 0 ? (
                    <p className="text-xs text-slate-500">{t('addStaffHintEmpty')}</p>
                  ) : (
                    <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                      {allowanceRecipients.map((m) => (
                        <li key={m.id} className="flex justify-between gap-2">
                          <span className="truncate">{m.display_name}</span>
                          <button
                            type="button"
                            disabled={memberPatchBusy === m.id}
                            onClick={() => void patchMember(m.id, { receivesStaffAllowance: false })}
                            className="shrink-0 text-violet-700 dark:text-violet-400 font-semibold hover:underline"
                          >
                            {t('removeVoucher')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-3 bg-slate-50/50 dark:bg-zinc-900/30">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('newStaffTitle')}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {t.rich('newStaffLead', {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <div className="relative">
          <label className="block text-xs text-slate-600 dark:text-slate-300">
            {t('clientRecordLabel')}
            <div className="mt-1 flex items-center gap-2">
              <input
                role="combobox"
                value={pickQ}
                onChange={(e) => {
                  setPickQ(e.target.value);
                  if (pickedMember && e.target.value !== pickedMember.display_name) {
                    setPickedMember(null);
                  }
                }}
                onFocus={() => {
                  if (pickBlurTimer.current) clearTimeout(pickBlurTimer.current);
                  setPickFocused(true);
                }}
                onBlur={() => schedulePickBlur()}
                placeholder={t('searchPlaceholder')}
                autoComplete="off"
                aria-expanded={showPickDropdown}
                aria-controls={pickListId}
                aria-autocomplete="list"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
              />
              {pickBusy ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[#2563eb]" /> : null}
            </div>
          </label>
          {pickedMember ? (
            <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
              {t('selectionPrefix')} {pickedMember.display_name}{' '}
              <span className="font-mono text-slate-500">{pickedMember.phone_e164}</span>
            </p>
          ) : null}
          {showPickDropdown ? (
            <ul
              id={pickListId}
              role="listbox"
              aria-label={t('pickListAria')}
              className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-lg py-1 text-sm"
              onMouseDown={(e) => e.preventDefault()}
            >
              {pickBusy ? (
                <li className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  {t('searching')}
                </li>
              ) : null}
              {!pickBusy && pickHits.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-500">{t('noHits')}</li>
              ) : null}
              {pickHits.map((m) => (
                <li key={m.id} className="border-b border-slate-100 dark:border-zinc-800 last:border-0">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-900"
                    onClick={() => {
                      setPickedMember(m);
                      setPickQ(m.display_name);
                      setPickFocused(false);
                    }}
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-50 truncate">{m.display_name}</p>
                    <p className="text-[11px] font-mono text-slate-500">{m.phone_e164}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <label className="block text-xs text-slate-500">
          {t('pinLabel')}
          <input
            inputMode="numeric"
            autoComplete="new-password"
            value={addPin}
            onChange={(e) => setAddPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={t('pinPlaceholder')}
            className="mt-1 w-full max-w-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-mono tracking-widest"
          />
        </label>
        <button
          type="button"
          disabled={addBusy}
          onClick={() => void addStaff()}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {addBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('addStaff')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('loading')}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t('emptyStaff')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-slate-50 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>{r.display_name}</span>
                  {r.pin_public_code ? (
                    <span className="font-mono text-sm font-bold text-[#2563eb] tabular-nums tracking-wide">
                      · {r.pin_public_code}
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                      {t('codeUndefined')}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {r.is_active ? (
                    <span className="text-emerald-600 dark:text-emerald-400">{t('activeTerminal')}</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">{t('disabled')}</span>
                  )}
                </p>
                <StaffPinReset staffId={r.id} onSaved={() => void load()} />
              </div>
              <div className="flex flex-wrap gap-2 justify-end shrink-0">
                {r.is_active ? (
                  <button
                    type="button"
                    onClick={() => void setActive(r.id, false)}
                    className="min-h-[40px] px-3 rounded-lg border border-red-200 dark:border-red-900/50 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {t('deactivate')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setActive(r.id, true)}
                    className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-zinc-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    {t('reactivate')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDeletePhrase('');
                    setDeleteTarget({ id: r.id, display_name: r.display_name });
                  }}
                  className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-zinc-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 inline-flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4 opacity-80" />
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 sm:p-6">
              <button
                type="button"
                aria-label={t('close')}
                disabled={deleteBusy}
                className="absolute inset-0 bg-slate-950/45 dark:bg-black/55 backdrop-blur-md transition-opacity disabled:pointer-events-none"
                onClick={() => {
                  if (!deleteBusy) closeDeleteModal();
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="banano-staff-delete-title"
                className="relative w-full max-w-[min(100%,420px)] rounded-2xl border border-slate-200/90 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl shadow-black/25 dark:shadow-black/50"
              >
                <div className="flex items-start justify-between gap-3 p-5 pb-0">
                  <div className="min-w-0">
                    <p
                      id="banano-staff-delete-title"
                      className="text-base font-bold text-slate-900 dark:text-slate-50 leading-snug"
                    >
                      {t('deleteTitle')}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {deleteTarget.display_name}
                      </span>{' '}
                      {t('deleteLead')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => {
                      if (!deleteBusy) closeDeleteModal();
                    }}
                    className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                    aria-label={t('close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 space-y-4 pt-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('deleteConfirmPart1')}{' '}
                      <span className="font-mono text-[#2563eb]">{t('deleteConfirmWord')}</span>{' '}
                      {t('deleteConfirmPart2')}
                    </span>
                    <input
                      type="text"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={deletePhrase}
                      onChange={(e) => setDeletePhrase(e.target.value)}
                      placeholder={t('deleteConfirmWord')}
                      className="mt-2 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm font-medium"
                    />
                  </label>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                    <button
                      type="button"
                      disabled={deleteBusy}
                      onClick={() => closeDeleteModal()}
                      className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-zinc-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={deleteBusy || !phraseOk}
                      onClick={() => void removeStaff(deleteTarget.id)}
                      className="min-h-[44px] px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {t('deleteForever')}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
