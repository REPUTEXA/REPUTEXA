'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cake, Loader2, Sparkles, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { WhatsAppMark } from '@/components/banano/whatsapp-mark';
import { isBirthdayToday } from '@/lib/banano/loyalty-timeline-labels';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { useDashboardDisplayTimeZone } from '@/components/dashboard/dashboard-timezone-provider';

type MemberLite = {
  id: string;
  phone_e164: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  birth_date?: string | null;
  /** Pour reformulation IA « mémoire client » (relance / absence). */
  last_visit_at?: string | null;
};

type Props = {
  member: MemberLite | null;
  onClose: () => void;
  onSent: () => void;
};

function greetingName(m: MemberLite): string {
  const f = (m.first_name ?? '').trim();
  if (f) return f;
  const d = (m.display_name ?? '').trim();
  if (d) return d.split(/\s+/)[0] ?? d;
  return '';
}

export function ManualWhatsAppComposerModal({ member, onClose, onSent }: Props) {
  const t = useTranslations('Dashboard.bananoManualWhatsapp');
  const locale = useLocale();
  const intlDate = siteLocaleToIntlDateTag(locale);
  const merchantDisplayTz = useDashboardDisplayTimeZone();
  const [draft, setDraft] = useState('');
  const [scheduleOn, setScheduleOn] = useState(false);
  /** Valeur pour input datetime-local (fuseau navigateur). */
  const [scheduleLocal, setScheduleLocal] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [rephraseBusy, setRephraseBusy] = useState(false);

  useEffect(() => {
    if (!member) {
      setDraft('');
      setScheduleOn(false);
      setScheduleLocal('');
      return;
    }
    const name = greetingName(member);
    setDraft(name ? t('draftGreeting', { name }) : '');
    setScheduleOn(false);
    setScheduleLocal('');
  }, [member, t]);

  async function rephrase() {
    const draftText = draft.trim();
    if (draftText.length < 3) {
      toast.error(t('toastDraftShort'));
      return;
    }
    setRephraseBusy(true);
    try {
      const loyalty_context = member
        ? (() => {
            const prenom = greetingName(member) || undefined;
            if (member.birth_date && isBirthdayToday(member.birth_date, merchantDisplayTz)) {
              return { scenario: 'birthday' as const, prenom };
            }
            if (member.last_visit_at) {
              const days = Math.floor(
                (Date.now() - new Date(member.last_visit_at).getTime()) / 86400000
              );
              if (days >= 14) {
                return { scenario: 'lost_client' as const, days_inactive: days, prenom };
              }
            }
            return { scenario: 'manual' as const, prenom };
          })()
        : undefined;
      const res = await fetch('/api/banano/crm/manual-whatsapp/rephrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: draftText, loyalty_context }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      if (data.text) {
        setDraft(data.text);
        toast.success(t('toastRephrased'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setRephraseBusy(false);
    }
  }

  async function submit() {
    if (!member) return;
    const message = draft.trim();
    if (message.length < 1) {
      toast.error(t('toastEmpty'));
      return;
    }

    let scheduledAt: string | null = null;
    if (scheduleOn) {
      if (!scheduleLocal.trim()) {
        toast.error(t('toastPickSchedule'));
        return;
      }
      const ts = new Date(scheduleLocal).getTime();
      if (Number.isNaN(ts)) {
        toast.error(t('toastInvalidDate'));
        return;
      }
      if (ts <= Date.now() + 90_000) {
        toast.error(t('toastScheduleLead'));
        return;
      }
      scheduledAt = new Date(ts).toISOString();
    }

    setSubmitBusy(true);
    try {
      const res = await fetch('/api/banano/crm/manual-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          message,
          scheduledAt: scheduleOn ? scheduledAt : null,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        mode?: string;
        error?: string;
        scheduledAt?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));

      if (data.mode === 'scheduled') {
        toast.success(t('toastScheduled'), {
          description: data.scheduledAt
            ? new Date(data.scheduledAt).toLocaleString(intlDate, {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : undefined,
        });
      } else {
        toast.success(t('toastSent'));
      }
      onSent();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setSubmitBusy(false);
    }
  }

  if (typeof document === 'undefined' || !member) return null;

  const name = greetingName(member);
  const bday = isBirthdayToday(member.birth_date, merchantDisplayTz);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-wa-title"
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl flex flex-col max-h-[min(92vh,640px)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start gap-3 p-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
            <WhatsAppMark className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="manual-wa-title" className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {t('title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {name || t('customerFallback')}
              {t('customerMetaSeparator')}
              <span className="font-mono text-xs">{member.phone_e164}</span>
              {bday ? (
                <span className="ml-2 inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  <Cake className="w-3.5 h-3.5" />
                  {t('birthdayBadge')}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {t('yourMessage')}
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 text-sm leading-relaxed resize-y min-h-[140px] focus:outline-none focus:ring-2 focus:ring-[#25D366]/35"
              placeholder={t('placeholder')}
              maxLength={4000}
            />
            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
              {t('draftCharCount', { current: draft.length, max: 4000 })}
            </p>
          </div>

          <button
            type="button"
            disabled={rephraseBusy || draft.trim().length < 3}
            onClick={() => void rephrase()}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200 text-sm font-semibold hover:bg-indigo-100/90 dark:hover:bg-indigo-950/50 disabled:opacity-50"
          >
            {rephraseBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t('rephraseAi')}
          </button>

          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/50 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={scheduleOn}
                onChange={(e) => setScheduleOn(e.target.checked)}
                className="rounded border-slate-300"
              />
              {t('scheduleLabel')}
            </label>
            {scheduleOn ? (
              <input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
              />
            ) : null}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('scheduleHint')}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 p-4 border-t border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={submitBusy || draft.trim().length < 1}
            onClick={() => void submit()}
            className="flex-1 min-h-[44px] rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {scheduleOn ? t('schedule') : t('sendNow')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
