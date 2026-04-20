'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Loader2, Download, Play, ChevronRight, Globe2, Rocket } from 'lucide-react';

type DraftRow = {
  id: string;
  localeCode: string;
  targetLabel: string | null;
  status: string;
  topLevelKeysDone: string[];
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
};

export function BabelExpansionClient() {
  const t = useTranslations('Admin.babelExpansionClient');
  const [localeCode, setLocaleCode] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [batchSize, setBatchSize] = useState(2);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeJson, setActiveJson] = useState<Record<string, unknown> | null>(null);
  const [doGit, setDoGit] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/babel-expansion-draft', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errListUnavailable'));
      setDrafts((j.drafts ?? []) as DraftRow[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorGeneric'));
    }
  }, [t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDraft = async (id: string) => {
    setErr(null);
    try {
      const r = await fetch(`/api/admin/babel-expansion-draft?id=${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errLoadFailed'));
      setActiveId(id);
      setActiveJson((j.draft?.messagesJson ?? null) as Record<string, unknown> | null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorGeneric'));
    }
  };

  const start = async () => {
    const code = localeCode.trim().toLowerCase();
    if (!/^[a-z]{2}(-[a-z]{2,4})?$/i.test(code)) {
      setErr(t('errInvalidIso'));
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/babel-expansion-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          localeCode: code,
          targetLabel: targetLabel.trim() || undefined,
          batchSize,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errStartFailed'));
      setMsg(j.message ?? t('msgOk'));
      setActiveId(j.draftId);
      await loadList();
      await loadDraft(j.draftId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const cont = async (draftId: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/babel-expansion-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'continue', draftId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errStartFailed'));
      setMsg(j.message ?? t('msgOk'));
      await loadList();
      await loadDraft(draftId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const downloadActive = () => {
    if (!activeId || !activeJson) return;
    const row = drafts.find((d) => d.id === activeId);
    const loc = row?.localeCode ?? 'locale';
    const blob = new Blob([JSON.stringify(activeJson, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `messages-${loc}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const applyMessagesToDisk = async (probeLocale: boolean) => {
    if (!activeId || !activeJson) return;
    const row = drafts.find((d) => d.id === activeId);
    const lc = row?.localeCode?.trim().toLowerCase();
    if (!lc) {
      setErr(t('errLocaleUnknown'));
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/babel-apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_messages',
          localeCode: lc,
          messagesJson: activeJson,
          probeLocale,
          gitCommit: doGit,
          commitMessage: t('gitCommitMessage', { locale: lc }),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errWriteRefused'));
      const httpStatus = j.probe?.status != null ? ` (${j.probe.status})` : '';
      const errorSuffix = j.probe?.error ? ` — ${j.probe.error}` : '';
      const lines = [
        j.ok ? t('applyLineOk') : t('applyLinePartial'),
        ...(j.written?.length ? [t('applyLineFiles', { list: (j.written as string[]).join(', ') })] : []),
        ...(j.errors?.length ? [t('applyLineErrors', { list: (j.errors as string[]).join('; ') })] : []),
        j.probe
          ? t('applyLineProbe', {
              locale: lc,
              outcome: j.probe.ok ? t('probeOutcomeOk') : t('probeOutcomeFail'),
              httpStatus,
              errorSuffix,
            })
          : null,
        j.git?.ok ? t('applyGitOk') : j.git?.stderr ? t('applyGitErr', { stderr: j.git.stderr }) : null,
      ].filter(Boolean) as string[];
      setMsg(lines.join('\n'));
      if (!j.ok) setErr((j.errors as string[])?.join('; ') ?? t('errorGeneric'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const activeLocaleCode = drafts.find((d) => d.id === activeId)?.localeCode ?? '';

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-xs leading-relaxed text-violet-100/90">
        <p className="font-medium text-violet-200">{t('introTitle')}</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-violet-100/75">
          <li>
            {t.rich('introBullet1', {
              bold: (chunks) => <strong className="text-violet-200">{chunks}</strong>,
              code: (chunks) => <code className="text-violet-200/90">{chunks}</code>,
            })}
          </li>
          <li>
            {t.rich('introBullet2', {
              bold: (chunks) => <strong className="text-violet-200">{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich('introBullet3', {
              wizard: (chunks) => (
                <Link href="/dashboard/admin/babel-guardian/wizard" className="text-indigo-300 hover:text-indigo-200">
                  {chunks}
                </Link>
              ),
              guardian: (chunks) => (
                <Link href="/dashboard/admin/babel-guardian" className="text-indigo-300 hover:text-indigo-200">
                  {chunks}
                </Link>
              ),
            })}
          </li>
        </ul>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-violet-400" />
          {t('sectionNewTitle')}
        </h2>
        <p className="text-xs text-zinc-500">
          {t.rich('sectionNewIntro', {
            codeFr: (chunks) => <code className="text-zinc-400">{chunks}</code>,
            codeEnv: (chunks) => <code className="text-zinc-400">{chunks}</code>,
            codeDefault: (chunks) => <code className="text-zinc-400">{chunks}</code>,
          })}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t('labelIsoCode')}
            <input
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
              placeholder={t('placeholderIsoCode')}
              value={localeCode}
              onChange={(e) => setLocaleCode(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t('labelMarketPrompt')}
            <input
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder={t('placeholderMarket')}
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400 sm:col-span-2">
            {t('labelBatchRootKeys')}
            <input
              type="number"
              min={1}
              max={5}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white w-24"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 2)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {t('buttonStartGeneration')}
        </button>
      </section>

      {err ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm text-red-200">{err}</div>
      ) : null}
      {msg ? (
        <div className="whitespace-pre-line rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-100">
          {msg}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">{t('sectionDraftsTitle')}</h2>
        <ul className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-950/50">
          {drafts.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-600">{t('emptyDrafts')}</li>
          ) : (
            drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="font-mono text-indigo-300">{d.localeCode}</span>
                <span className="text-zinc-500">{d.targetLabel ?? '—'}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    d.status === 'ready'
                      ? 'bg-emerald-950/60 text-emerald-300'
                      : d.status === 'error'
                        ? 'bg-red-950/60 text-red-300'
                        : 'bg-amber-950/60 text-amber-200'
                  }`}
                >
                  {d.status === 'ready' ? t('statusReady') : d.status === 'error' ? t('statusError') : d.status}
                </span>
                <span className="text-xs text-zinc-600">
                  {t('rootKeysCount', { count: d.topLevelKeysDone?.length ?? 0 })}
                </span>
                {d.errorMessage ? (
                  <span className="w-full text-xs text-red-400">{d.errorMessage}</span>
                ) : null}
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || d.status === 'ready'}
                    onClick={() => void cont(d.id)}
                    className="rounded-lg border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {t('btnContinueBatch')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadDraft(d.id)}
                    className="rounded-lg border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    {t('btnLoadJson')}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {activeId && activeJson ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-zinc-300">{t('sectionPreviewTitle')}</h2>
            <button
              type="button"
              onClick={() => downloadActive()}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
            >
              <Download className="h-3.5 w-3.5" />
              {t('btnDownloadJson')}
            </button>
          </div>
          <div className="rounded-xl border border-orange-500/35 bg-orange-950/20 px-3 py-3 text-[11px] leading-relaxed text-orange-100/90">
            <p className="font-medium text-orange-200">{t('fullNativeTitle')}</p>
            <p className="mt-1 text-orange-100/75">
              {t.rich('fullNativeBody', {
                locale: activeLocaleCode,
                codePath: (chunks) => <code className="text-orange-200/90">{chunks}</code>,
                codeEnv: (chunks) => <code className="text-orange-200/90">{chunks}</code>,
                wizard: (chunks) => (
                  <Link href="/dashboard/admin/babel-guardian/wizard" className="text-indigo-300 hover:text-indigo-200">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-orange-200/90">
              <input type="checkbox" checked={doGit} onChange={(e) => setDoGit(e.target.checked)} />
              {t.rich('labelGitCommit', {
                code: (chunks) => <code className="text-orange-200/80">{chunks}</code>,
              })}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyMessagesToDisk(false)}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                {t('btnFullNativeWrite')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyMessagesToDisk(true)}
                className="rounded-lg border border-orange-500/50 px-3 py-1.5 text-xs text-orange-200 hover:bg-orange-950/40 disabled:opacity-50"
              >
                {t('btnProbeSuffix', { locale: activeLocaleCode || '…' })}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-zinc-600">{t('hintRename')}</p>
          <pre className="max-h-64 overflow-auto rounded-xl border border-zinc-800 bg-black/40 p-3 text-[10px] text-zinc-500">
            {JSON.stringify(activeJson, null, 2).slice(0, 8000)}
            {JSON.stringify(activeJson, null, 2).length > 8000 ? t('jsonTruncated') : ''}
          </pre>
        </section>
      ) : null}

      <p className="text-center">
        <Link
          href="/dashboard/admin/babel-guardian"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          {t('footerBackLink')}
        </Link>
      </p>
    </div>
  );
}
