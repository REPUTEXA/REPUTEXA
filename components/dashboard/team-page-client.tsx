'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toast } from 'sonner';

type MemberRow = {
  id: string;
  member_user_id: string;
  role: string;
  status: string;
  displayName: string;
  tasksCompletedWeek: number;
  walletScansToday: number;
  last_seen_at: string | null;
  created_at: string;
};

type TerminalPin = {
  id: string;
  displayName: string;
  linkedAuthUserId: string | null;
};

const PHONE_DEFAULT_COUNTRY: Record<string, string> = {
  fr: 'FR',
  en: 'US',
  'en-gb': 'GB',
  de: 'DE',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  ja: 'JP',
  zh: 'CN',
};

export function TeamPageClient() {
  const t = useTranslations('Dashboard.team');
  const locale = useLocale();
  const phoneDefaultCountry = PHONE_DEFAULT_COUNTRY[locale] ?? 'US';
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pins, setPins] = useState<TerminalPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [pinSavingMemberId, setPinSavingMemberId] = useState<string | null>(null);
  /** PhoneInput SSR output differs from the client; render only after mount to avoid hydration removeChild errors. */
  const [phoneInputMounted, setPhoneInputMounted] = useState(false);

  const loadPins = useCallback(async () => {
    try {
      const res = await fetch('/api/team/terminal-pins');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const raw = Array.isArray(data.pins) ? data.pins : [];
      setPins(
        raw.map((p: { id: string; displayName: string; linkedAuthUserId?: string | null }) => ({
          id: p.id,
          displayName: p.displayName,
          linkedAuthUserId: p.linkedAuthUserId ?? null,
        }))
      );
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team/members');
      const data = await res.json();
      if (!res.ok) throw new Error('load');
      setMembers(Array.isArray(data.members) ? data.members : []);
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  useEffect(() => {
    setPhoneInputMounted(true);
  }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    if (!phone || !isPossiblePhoneNumber(phone)) {
      toast.error(t('phoneInvalid'));
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: name.trim(),
          phone,
          role: 'staff',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('inviteError'));
        return;
      }
      toast.success(data.whatsappSent ? t('inviteSentWa') : t('inviteSentNoWa'));
      setName('');
      setPhone('');
    } catch {
      toast.error(t('inviteError'));
    } finally {
      setSending(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm(t('revokeConfirm'))) return;
    const res = await fetch(`/api/team/members/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('revokeError'));
      return;
    }
    toast.success(t('revoked'));
    load();
  }

  async function setRole(id: string, role: 'staff' | 'manager') {
    const res = await fetch(`/api/team/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      toast.error(t('roleError'));
      return;
    }
    toast.success(t('roleSaved'));
    load();
  }

  function linkedPinIdForMember(memberUserId: string): string {
    const hit = pins.find((p) => p.linkedAuthUserId === memberUserId);
    return hit?.id ?? '';
  }

  async function savePinLink(memberRowId: string, pinId: string) {
    setPinSavingMemberId(memberRowId);
    try {
      const res = await fetch(`/api/team/members/${memberRowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkTerminalStaffId: pinId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('loadError'));
        return;
      }
      toast.success(t('linkPinSaved'));
      await loadPins();
      load();
    } catch {
      toast.error(t('loadError'));
    } finally {
      setPinSavingMemberId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10 items-start">
        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-5 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('inviteTitle')}</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 mb-4">{t('inviteHint')}</p>
          <form onSubmit={sendInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                {t('nameLabel')}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                {t('phoneLabel')}
              </label>
              {phoneInputMounted ? (
                <PhoneInput
                  international
                  defaultCountry={phoneDefaultCountry as Country}
                  value={phone || undefined}
                  onChange={(v) => setPhone(v ?? '')}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              ) : (
                <div
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 animate-pulse"
                  aria-hidden
                />
              )}
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60"
            >
              {sending ? t('sending') : t('inviteCta')}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-5 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('listTitle')}</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2">{t('linkPinHint')}</p>
          {loading ? (
            <p className="text-sm text-slate-500 mt-4">{t('loading')}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-500 mt-4">{t('empty')}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-100 dark:border-zinc-800 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {m.displayName}
                      {m.status === 'revoked' && (
                        <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400">
                          ({t('statusRevoked')})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">
                      {t('statsLine', {
                        tasks: m.tasksCompletedWeek,
                        scans: m.walletScansToday,
                      })}
                    </p>
                    {m.status !== 'revoked' && (
                      <div className="mt-2 flex flex-col gap-1 max-w-xs">
                        <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                          {t('linkPinLabel')}
                        </label>
                        <select
                          className="text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 disabled:opacity-50"
                          disabled={pinSavingMemberId === m.id}
                          value={linkedPinIdForMember(m.member_user_id)}
                          onChange={(e) => savePinLink(m.id, e.target.value)}
                        >
                          <option value="">{t('linkPinNone')}</option>
                          {pins.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={m.role}
                      disabled={m.status === 'revoked'}
                      onChange={(e) => setRole(m.id, e.target.value === 'manager' ? 'manager' : 'staff')}
                      className="text-sm rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 disabled:opacity-50"
                    >
                      <option value="staff">{t('roleStaff')}</option>
                      <option value="manager">{t('roleManager')}</option>
                    </select>
                    {m.status !== 'revoked' && (
                      <button
                        type="button"
                        onClick={() => revoke(m.id)}
                        className="text-sm min-h-[36px] px-3 rounded-lg bg-red-600 text-white font-medium"
                      >
                        {t('revoke')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
