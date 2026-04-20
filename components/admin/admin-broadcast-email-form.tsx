'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Mail, Send, Sparkles, Wand2, Lock, Unlock, Info, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { broadcastFrMasterUnlockSnapshot } from '@/lib/admin/broadcast-email-shared';

const BROADCAST_DRAFT_KEY = 'reputexa_admin_broadcast_draft_v1';

type BroadcastDraftV1 = {
  v: 1;
  rawMessage: string;
  formatNote: string;
  subjectFr: string;
  htmlFr: string;
  revisionNote: string;
  /** Valeur brute `datetime-local` (fuseau du navigateur → convertie en ISO à l’envoi). */
  scheduleLocal: string;
};

export function AdminBroadcastEmailForm({ adminSecret }: { adminSecret: string }) {
  const t = useTranslations('Dashboard.adminBroadcastEmailForm');
  const locale = useLocale();
  const [rawMessage, setRawMessage] = useState('');
  const [formatNote, setFormatNote] = useState('');
  const [subjectFr, setSubjectFr] = useState('');
  const [htmlFr, setHtmlFr] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [scheduleLocal, setScheduleLocal] = useState('');
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [snapshotAtTest, setSnapshotAtTest] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftBootstrapped, setDraftBootstrapped] = useState(false);

  useLayoutEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(BROADCAST_DRAFT_KEY) : null;
      if (!raw) {
        setDraftBootstrapped(true);
        return;
      }
      const p = JSON.parse(raw) as Partial<BroadcastDraftV1>;
      if (p.v !== 1) {
        setDraftBootstrapped(true);
        return;
      }
      setRawMessage(typeof p.rawMessage === 'string' ? p.rawMessage : '');
      setFormatNote(typeof p.formatNote === 'string' ? p.formatNote : '');
      setSubjectFr(typeof p.subjectFr === 'string' ? p.subjectFr : '');
      setHtmlFr(typeof p.htmlFr === 'string' ? p.htmlFr : '');
      setRevisionNote(typeof p.revisionNote === 'string' ? p.revisionNote : '');
      setScheduleLocal(typeof p.scheduleLocal === 'string' ? p.scheduleLocal : '');
      const has =
        (typeof p.rawMessage === 'string' && p.rawMessage.trim()) ||
        (typeof p.subjectFr === 'string' && p.subjectFr.trim()) ||
        (typeof p.htmlFr === 'string' && p.htmlFr.trim());
      if (has) toast.info(t('toastDraftRestored'));
    } catch {
      /* ignore */
    }
    setDraftBootstrapped(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot draft restore; t matches mount locale
  }, []);

  useEffect(() => {
    if (!draftBootstrapped) return;
    const id = setTimeout(() => {
      try {
        const payload: BroadcastDraftV1 = {
          v: 1,
          rawMessage,
          formatNote,
          subjectFr,
          htmlFr,
          revisionNote,
          scheduleLocal,
        };
        localStorage.setItem(BROADCAST_DRAFT_KEY, JSON.stringify(payload));
      } catch {
        /* private mode / quota */
      }
    }, 450);
    return () => clearTimeout(id);
  }, [draftBootstrapped, rawMessage, formatNote, subjectFr, htmlFr, revisionNote, scheduleLocal]);

  const snapshotNow = useMemo(() => broadcastFrMasterUnlockSnapshot(subjectFr, htmlFr), [subjectFr, htmlFr]);
  const contentMatchesTest = snapshotAtTest !== null && snapshotAtTest === snapshotNow;

  const canSendAll = Boolean(
    unlockToken &&
      fingerprint &&
      subjectFr.trim() &&
      htmlFr.trim() &&
      contentMatchesTest
  );

  const clearUnlock = () => {
    setUnlockToken(null);
    setFingerprint(null);
    setSnapshotAtTest(null);
  };

  const runFormat = async () => {
    if (!rawMessage.trim()) {
      toast.error(t('toastFormatEmpty'));
      return;
    }
    setBusy('format');
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({
          action: 'format_raw',
          rawMessage: rawMessage.trim(),
          aiInstruction: formatNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('toastGenericError'));
      setSubjectFr(data.subjectFr ?? '');
      setHtmlFr(data.htmlFr ?? '');
      clearUnlock();
      toast.success(t('toastFormatSuccess'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastAiError'));
    } finally {
      setBusy(null);
    }
  };

  const runRevise = async () => {
    if (!htmlFr.trim()) {
      toast.error(t('toastReviseNoHtml'));
      return;
    }
    if (!revisionNote.trim()) {
      toast.error(t('toastReviseNoNote'));
      return;
    }
    setBusy('revise');
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({
          action: 'improve',
          subjectFr: subjectFr.trim(),
          htmlFr: htmlFr.trim(),
          aiInstruction: revisionNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('toastGenericError'));
      setSubjectFr(data.subjectFr ?? subjectFr);
      setHtmlFr(data.htmlFr ?? htmlFr);
      clearUnlock();
      toast.success(t('toastReviseSuccess'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastAiError'));
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    if (!subjectFr.trim() || !htmlFr.trim()) {
      toast.error(t('toastSubjectBodyRequired'));
      return;
    }
    const snap = broadcastFrMasterUnlockSnapshot(subjectFr, htmlFr);
    setBusy('test');
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({
          action: 'test_send',
          subjectFr: subjectFr.trim(),
          htmlFr: htmlFr.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('toastGenericError'));
      setFingerprint(data.fingerprint ?? null);
      setUnlockToken(data.unlockToken ?? null);
      setSnapshotAtTest(snap);
      toast.success(t('toastTestSuccess'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastGenericError'));
    } finally {
      setBusy(null);
    }
  };

  const runSendAll = async () => {
    if (!unlockToken || !fingerprint) {
      toast.error(t('toastPreviewFirst'));
      return;
    }
    if (!confirm(t('confirmSendAll'))) return;
    setBusy('send_all');
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({
          action: 'send_all',
          subjectFr: subjectFr.trim(),
          htmlFr: htmlFr.trim(),
          unlockToken,
          fingerprint,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('toastGenericError'));
      toast.success(
        t('toastSendAllResult', {
          sent: data.emailsSent ?? 0,
          failed: data.emailsFailed ?? 0,
          total: data.totalUsers ?? 0,
        })
      );
      clearUnlock();
      try {
        localStorage.removeItem(BROADCAST_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setRawMessage('');
      setFormatNote('');
      setSubjectFr('');
      setHtmlFr('');
      setRevisionNote('');
      setScheduleLocal('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastGenericError'));
    } finally {
      setBusy(null);
    }
  };

  const runSchedule = async () => {
    if (!subjectFr.trim() || !htmlFr.trim()) {
      toast.error(t('toastScheduleNeedContent'));
      return;
    }
    if (!scheduleLocal.trim()) {
      toast.error(t('toastScheduleNeedDateTime'));
      return;
    }
    const instant = new Date(scheduleLocal);
    if (Number.isNaN(instant.getTime())) {
      toast.error(t('toastScheduleBadDateTime'));
      return;
    }
    const scheduledAtIso = instant.toISOString();
    setBusy('schedule');
    try {
      const res = await fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({
          action: 'schedule',
          subjectFr: subjectFr.trim(),
          htmlFr: htmlFr.trim(),
          scheduled_at: scheduledAtIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('toastGenericError'));
      clearUnlock();
      const when = new Date(data.scheduled_at ?? scheduledAtIso).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      toast.success(t('toastScheduleSuccess', { when }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastGenericError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-zinc-400 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          {t.rich('introRich', {
            auto: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
            profilesCode: (chunks) => <code className="text-zinc-500">{chunks}</code>,
            adminEmail: (chunks) => <code className="text-zinc-500">{chunks}</code>,
            schedWord: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
            negation: (chunks) => <em>{chunks}</em>,
          })}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
        <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
          {t('labelFreeText')}
        </label>
        <textarea
          value={rawMessage}
          onChange={(e) => {
            setRawMessage(e.target.value);
            clearUnlock();
          }}
          rows={5}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          placeholder={t('placeholderRaw')}
        />
        <div>
          <label className="block text-[10px] text-zinc-500 mb-1">{t('labelFormatOptional')}</label>
          <input
            type="text"
            value={formatNote}
            onChange={(e) => {
              setFormatNote(e.target.value);
              clearUnlock();
            }}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
            placeholder={t('placeholderFormatNote')}
          />
        </div>
        <button
          type="button"
          onClick={() => void runFormat()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2"
        >
          {busy === 'format' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {t('buttonFormat')}
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] text-zinc-500 uppercase tracking-wide">{t('labelSubject')}</label>
        <input
          type="text"
          value={subjectFr}
          onChange={(e) => {
            setSubjectFr(e.target.value);
            clearUnlock();
          }}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
          placeholder={t('placeholderSubject')}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] text-zinc-500 uppercase tracking-wide">{t('labelHtml')}</label>
        <textarea
          value={htmlFr}
          onChange={(e) => {
            setHtmlFr(e.target.value);
            clearUnlock();
          }}
          rows={10}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
          placeholder={t('placeholderHtml')}
        />
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 space-y-3">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-violet-400" aria-hidden />
          {t('refineTitle')}
        </p>
        <textarea
          value={revisionNote}
          onChange={(e) => {
            setRevisionNote(e.target.value);
          }}
          rows={2}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
          placeholder={t('placeholderRevision')}
        />
        <button
          type="button"
          onClick={() => void runRevise()}
          disabled={busy !== null || !htmlFr.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-500/25 border border-violet-500/40 hover:bg-violet-500/35 disabled:opacity-50 text-violet-100 text-xs font-medium px-3 py-2"
        >
          {busy === 'revise' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {t('buttonRevise')}
        </button>
      </div>

      <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-4 space-y-2">
        <p className="text-[11px] font-semibold text-sky-300/90 uppercase tracking-wide flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5" aria-hidden />
          {t('scheduleTitle')}
        </p>
        <p className="text-[10px] text-zinc-500">
          {t.rich('scheduleHelpRich', {
            browser: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
            cron: (chunks) => <code className="text-zinc-600">{chunks}</code>,
          })}
        </p>
        <input
          type="datetime-local"
          value={scheduleLocal}
          onChange={(e) => setScheduleLocal(e.target.value)}
          className="w-full max-w-md bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="button"
          onClick={() => void runSchedule()}
          disabled={busy !== null || !subjectFr.trim() || !htmlFr.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600/90 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2"
        >
          {busy === 'schedule' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
          {t('buttonSchedule')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/60">
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={busy !== null || !subjectFr.trim() || !htmlFr.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600/90 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2"
        >
          {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
          {t('buttonTest')}
        </button>
        <button
          type="button"
          onClick={() => void runSendAll()}
          disabled={busy !== null || !canSendAll}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2"
          title={!canSendAll ? t('sendAllDisabledTitle') : undefined}
        >
          {busy === 'send_all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {canSendAll ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          {t('buttonSendAll')}
        </button>
      </div>

      {fingerprint && (
        <p className="text-[10px] text-zinc-500 font-mono break-all">
          {t('fingerprintPrefix')}
          {fingerprint.slice(0, 24)}…{' '}
          {contentMatchesTest ? (
            <span className="text-emerald-500">{t('fingerprintMatchNote')}</span>
          ) : (
            <span className="text-amber-500">{t('fingerprintMismatchNote')}</span>
          )}
        </p>
      )}
    </div>
  );
}
