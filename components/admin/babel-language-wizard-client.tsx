'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import {
  BABEL_WIZARD_STEP_IDS,
  type BabelWizardState,
  type BabelWizardStepId,
  buildWizardBackupJson,
  emptyWizardState,
  parseWizardBackupJson,
  wizardStepMeta,
} from '@/lib/babel/babel-wizard-types';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  HardDriveDownload,
  Loader2,
  RotateCcw,
  Rocket,
  Save,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';

const STEP_LAST = BABEL_WIZARD_STEP_IDS.length - 1;

/** Clés Admin.babelWizard pour les titres / sous-titres d’étapes */
const BABEL_STEP_TITLE_KEY: Record<BabelWizardStepId, string> = {
  checkpoint: 'stepMeta_checkpoint_title',
  catalog: 'stepMeta_catalog_title',
  messages: 'stepMeta_messages_title',
  serverPack: 'stepMeta_serverPack_title',
  authEmail: 'stepMeta_authEmail_title',
  signup: 'stepMeta_signup_title',
  seo: 'stepMeta_seo_title',
  warRoom: 'stepMeta_warRoom_title',
  emailsProduct: 'stepMeta_emailsProduct_title',
  done: 'stepMeta_done_title',
};
const BABEL_STEP_SHORT_KEY: Record<BabelWizardStepId, string> = {
  checkpoint: 'stepMeta_checkpoint_short',
  catalog: 'stepMeta_catalog_short',
  messages: 'stepMeta_messages_short',
  serverPack: 'stepMeta_serverPack_short',
  authEmail: 'stepMeta_authEmail_short',
  signup: 'stepMeta_signup_short',
  seo: 'stepMeta_seo_short',
  warRoom: 'stepMeta_warRoom_short',
  emailsProduct: 'stepMeta_emailsProduct_short',
  done: 'stepMeta_done_short',
};

/** IDs d’étape pour patchOutput — hors JSX (ESLint i18next/no-literal-string). */
const WIZARD_PATCH_STEP: Record<
  'catalog' | 'messages' | 'serverPack' | 'signup' | 'seo',
  BabelWizardStepId
> = {
  catalog: 'catalog',
  messages: 'messages',
  serverPack: 'serverPack',
  signup: 'signup',
  seo: 'seo',
};

function stepIdAt(index: number): BabelWizardStepId {
  return BABEL_WIZARD_STEP_IDS[Math.max(0, Math.min(index, STEP_LAST))]!;
}

function needsApproval(stepId: BabelWizardStepId): boolean {
  return [
    'catalog',
    'messages',
    'serverPack',
    'authEmail',
    'signup',
    'seo',
    'warRoom',
    'emailsProduct',
  ].includes(stepId);
}

export function BabelLanguageWizardClient() {
  const t = useTranslations('Admin.babelWizard');
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [localeInput, setLocaleInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [state, setState] = useState<BabelWizardState>(() => emptyWizardState('xx', '—'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; title: string | null; updatedAt: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Fusion tmp → site-locales-catalog, server pack, signup, SEO, stubs */
  const [mergeTs, setMergeTs] = useState(true);
  /** Nécessite BABEL_GIT_COMMIT_ENABLED=true côté serveur */
  const [doGit, setDoGit] = useState(false);

  const stepId = stepIdAt(state.stepIndex);
  const stepMeta = useMemo(() => {
    const base = wizardStepMeta(stepId);
    const title = t(BABEL_STEP_TITLE_KEY[stepId] as Parameters<typeof t>[0]);
    const short =
      stepId === 'signup'
        ? t('stepMeta_signup_short', { localeCode: state.localeCode })
        : t(BABEL_STEP_SHORT_KEY[stepId] as Parameters<typeof t>[0]);
    return { title, short, usesAi: base.usesAi };
  }, [stepId, state.localeCode, t]);

  const syncInputsFromState = useCallback((s: BabelWizardState) => {
    setLocaleInput(s.localeCode);
    setLabelInput(s.targetLabel);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/babel-language-wizard', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errListSessions'));
      setSessions(j.sessions ?? []);
    } catch {
      /* ignore list errors */
    }
  }, [t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const persistServer = useCallback(
    async (next: BabelWizardState, title?: string): Promise<string | undefined> => {
      const r = await fetch('/api/admin/babel-language-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: serverSessionId ?? undefined,
          title: title ?? `${next.localeCode} — ${next.targetLabel}`,
          state: next,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errSaveServer'));
      const returnedId = j.id as string | undefined;
      if (returnedId) setServerSessionId(returnedId);
      await loadSessions();
      return returnedId ?? serverSessionId ?? undefined;
    },
    [serverSessionId, loadSessions, t]
  );

  const downloadBackup = useCallback((note: string, stateOverride?: BabelWizardState, sessionIdOverride?: string | null) => {
    const st = stateOverride ?? state;
    const sid = sessionIdOverride !== undefined ? sessionIdOverride : serverSessionId;
    const blob = new Blob([buildWizardBackupJson({ state: st, serverSessionId: sid, note })], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `babel-wizard-${st.localeCode}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(t('msgBackupDownloaded'));
  }, [state, serverSessionId, t]);

  const applyLocaleFromInputs = () => {
    const code = localeInput.trim().toLowerCase();
    const label = labelInput.trim();
    if (!/^[a-z]{2}(-[a-z]{2,4})?$/i.test(code)) {
      setErr(t('errInvalidLocaleCode'));
      return false;
    }
    if (label.length < 2) {
      setErr(t('errLabelTooShort'));
      return false;
    }
    setErr(null);
    setState((s) => ({ ...s, localeCode: code, targetLabel: label }));
    return true;
  };

  const handleSaveEverything = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!applyLocaleFromInputs()) return;
      const next: BabelWizardState = {
        ...state,
        localeCode: localeInput.trim().toLowerCase(),
        targetLabel: labelInput.trim(),
      };
      setState(next);
      const sid = await persistServer(next);
      downloadBackup(t('backupNoteManual'), next, sid ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const loadSessionFromServer = async (id: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/babel-language-wizard?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errLoadSession'));
      const st = j.session.state as BabelWizardState;
      setServerSessionId(j.session.id);
      setState(st);
      syncInputsFromState(st);
      setMsg(t('msgSessionRestored'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const text = await f.text();
      const parsed = parseWizardBackupJson(text);
      if (!parsed) {
        setErr(t('errInvalidBackupFile'));
        return;
      }
      setState(parsed.state);
      syncInputsFromState(parsed.state);
      if (parsed.serverSessionId) setServerSessionId(parsed.serverSessionId);
      setMsg(t('msgImportedFile'));
    } catch {
      setErr(t('errReadFile'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const patchOutput = (id: BabelWizardStepId, patch: Partial<(typeof state.outputs)[typeof id]>) => {
    setState((s) => ({
      ...s,
      outputs: {
        ...s.outputs,
        [id]: { content: '', kind: 'snippet', approved: false, ...s.outputs[id], ...patch },
      },
    }));
  };

  const runAiStep = async (id: 'catalog' | 'serverPack' | 'signup' | 'seo') => {
    if (!applyLocaleFromInputs()) return;
    const code = localeInput.trim().toLowerCase();
    const label = labelInput.trim();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/babel-language-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          stepId: id,
          localeCode: code,
          targetLabel: label,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errAiUnavailable'));
      const notes = j.notes ? `${t('aiNotesSeparator')}${j.notes}` : '';
      patchOutput(id, {
        content: (j.content as string) + notes,
        kind: id === 'signup' ? 'snippet' : 'snippet',
        approved: false,
        generatedAt: new Date().toISOString(),
        error: undefined,
      });
      setMsg(t('msgPreviewGenerated'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const startMessagesDraft = async () => {
    if (!applyLocaleFromInputs()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/babel-expansion-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          localeCode: localeInput.trim().toLowerCase(),
          targetLabel: labelInput.trim(),
          batchSize: 3,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errStartMessagesFailed'));
      const draftId = j.draftId as string;
      setState((s) => ({ ...s, messagesDraftId: draftId }));
      setMsg(j.message ?? t('msgFirstBatchDefault'));
      await refreshMessagesDraft(draftId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const refreshMessagesDraft = async (draftId: string) => {
    const r = await fetch(`/api/admin/babel-expansion-draft?id=${encodeURIComponent(draftId)}`, {
      cache: 'no-store',
    });
    const j = await r.json();
    if (!r.ok) return;
    const d = j.draft;
    setState((s) => ({
      ...s,
      messagesProgressDone: d.topLevelKeysDone?.length ?? 0,
      messagesProgressTotal: undefined,
    }));
    const jsonStr = JSON.stringify(d.messagesJson ?? {}, null, 2);
    patchOutput('messages', {
      content: jsonStr,
      kind: 'json',
      approved: false,
    });
  };

  const continueOneMessagesBatch = async () => {
    const id = state.messagesDraftId;
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/babel-expansion-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'continue', draftId: id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errNextBatchFailed'));
      setMsg(j.message ?? t('msgShortOk'));
      await refreshMessagesDraft(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const runAllMessagesBatches = async () => {
    const id = state.messagesDraftId;
    if (!id) {
      setErr(t('errStartMessagesFirst'));
      return;
    }
    setBusy(true);
    setErr(null);
    let safety = 0;
    try {
      while (safety < 200) {
        safety += 1;
        const r = await fetch('/api/admin/babel-expansion-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'continue', draftId: id }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? t('errBatchGeneric'));
        await refreshMessagesDraft(id);
        if (j.status === 'ready') {
          setMsg(t('msgMessagesAllDone'));
          break;
        }
      }
      if (safety >= 200) setErr(t('errSafetyLimit'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (!applyLocaleFromInputs()) return;
    const merged: BabelWizardState = {
      ...state,
      localeCode: localeInput.trim().toLowerCase(),
      targetLabel: labelInput.trim(),
    };
    const id = stepIdAt(state.stepIndex);
    if (needsApproval(id) && !merged.outputs[id]?.approved) {
      setErr(t('errValidateStepFirst'));
      return;
    }
    setErr(null);
    const nextIndex = Math.min(state.stepIndex + 1, STEP_LAST);
    const next = { ...merged, stepIndex: nextIndex };
    setState(next);
    try {
      await persistServer(next);
    } catch {
      /* sauvegarde serveur best-effort */
    }
  };

  const goPrev = () => {
    setErr(null);
    setState((s) => ({ ...s, stepIndex: Math.max(0, s.stepIndex - 1) }));
  };

  const buildMergedState = (): BabelWizardState | null => {
    if (!applyLocaleFromInputs()) return null;
    return {
      ...state,
      localeCode: localeInput.trim().toLowerCase(),
      targetLabel: labelInput.trim(),
    };
  };

  const applyToDisk = async (probeLocale: boolean) => {
    const merged = buildMergedState();
    if (!merged) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/babel-apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_wizard_state',
          state: merged,
          probeLocale,
          mergeSnippets: mergeTs,
          gitCommit: doGit,
          commitMessage: `Babel: ${merged.localeCode} wizard`,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errApplyRefused'));
      const lines = [
        j.ok ? t('applyLineOk') : t('applyLineDoneErrors'),
        ...(j.written?.length
          ? [t('applyLineFiles', { list: (j.written as string[]).join(', ') })]
          : []),
        ...(j.errors?.length ? [t('applyLineErrors', { list: (j.errors as string[]).join('; ') })] : []),
        ...(j.warnings?.length
          ? [t('applyLineWarnings', { list: (j.warnings as string[]).join('; ') })]
          : []),
        j.merge
          ? t('applyLineSmartMerge', {
              status: j.merge.ok ? t('mergeStatusOk') : t('mergeStatusErr'),
              paths: (j.merge.gitPaths as string[])?.join(', ') || t('emDash'),
            })
          : null,
        j.merge?.errors?.length
          ? t('applyLineMergeErrors', { list: (j.merge.errors as string[]).join('; ') })
          : null,
        j.git?.ok
          ? t('applyLineGitCommit')
          : j.git?.stderr
            ? t('applyLineGitStderr', { stderr: j.git.stderr })
            : null,
        j.probe
          ? t('applyLineProbe', {
              localeCode: merged.localeCode,
              result: j.probe.ok ? t('probeOk') : t('probeFail'),
              statusPart: j.probe.status != null ? ` (${j.probe.status})` : '',
              errPart: j.probe.error ? ` — ${j.probe.error}` : '',
            })
          : null,
        j.hint ? t('applyLineHint', { hint: j.hint }) : null,
      ].filter(Boolean);
      setMsg(lines.join('\n'));
      if (!j.ok) setErr((j.errors as string[])?.join('; ') ?? t('applyErrDetail'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const applyOverlordFull = async (
    probeLocale: boolean,
    opts?: { forceGit?: boolean; commitMessage?: string; label?: string }
  ) => {
    const merged = buildMergedState();
    if (!merged) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const forceGit = opts?.forceGit === true;
    try {
      const r = await fetch('/api/admin/babel-apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_full_native',
          state: merged,
          probeLocale,
          gitCommit: forceGit || doGit,
          commitMessage:
            opts?.commitMessage ?? `Babel: add ${merged.localeCode} native support`,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errOverlordRefused'));
      const lines = [
        opts?.label ?? null,
        j.ok ? t('overlordLineOk') : t('overlordLineErrors'),
        j.disk?.written?.length
          ? t('overlordLineDisk', { list: (j.disk.written as string[]).join(', ') })
          : null,
        j.merge?.errors?.length
          ? t('applyLineMergeErrors', { list: (j.merge.errors as string[]).join('; ') })
          : null,
        j.git?.ok ? t('gitOkShort') : j.git?.stderr ? t('applyLineGitStderr', { stderr: j.git.stderr }) : null,
        j.probe
          ? t('overlordLineProbe', {
              status: j.probe.ok ? t('probeOk') : t('probeKo'),
              code: String(j.probe.status ?? t('emDash')),
            })
          : null,
        j.restartHint ? t('overlordLineRestart', { hint: j.restartHint }) : null,
        j.restartRequired ? t('overlordLineMarker') : null,
      ].filter(Boolean);
      setMsg(lines.join('\n'));
      if (!j.ok) setErr(t('overlordErrDetail'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  /** Point de singularité : disque + smart-merge + commit git + probe + rappel redémarrage dev */
  const singulariteFullNativeDeploy = async () => {
    const m = buildMergedState();
    if (!m) return;
    await applyOverlordFull(true, {
      forceGit: true,
      commitMessage: t('singulariteCommitMsg', { localeCode: m.localeCode }),
      label: t('singulariteLabel'),
    });
  };

  const applySmartMergeOnly = async () => {
    if (!applyLocaleFromInputs()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/babel-apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'smart_merge',
          localeCode: localeInput.trim().toLowerCase(),
          targetLabel: labelInput.trim(),
          gitCommit: doGit,
          commitMessage: `Babel smart-merge: ${localeInput.trim().toLowerCase()}`,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('errSmartMergeRefused'));
      const m = j.merge;
      setMsg(
        [
          m?.ok ? t('smartMergeOkLine') : t('smartMergeErrLine'),
          m?.gitPaths?.join(', '),
          m?.errors?.join('; '),
          j.git?.ok ? t('gitOkShort') : j.git?.stderr,
        ]
          .filter(Boolean)
          .join('\n')
      );
      if (!m?.ok) setErr(m?.errors?.join('; ') ?? t('errMergeGeneric'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const resetWizard = () => {
    if (!confirm(t('confirmReset'))) return;
    setServerSessionId(null);
    const fresh = emptyWizardState('xx', '—');
    setState(fresh);
    setLocaleInput('');
    setLabelInput('');
    setMsg(null);
    setErr(null);
  };

  const staticAuthBody = useMemo(
    () => t('staticAuthBody', { localeCode: state.localeCode }),
    [state.localeCode, t]
  );

  const staticWarBody = useMemo(
    () => t('staticWarBody', { localeCode: state.localeCode }),
    [state.localeCode, t]
  );

  const staticEmailsBody = useMemo(() => t('staticEmailsBody'), [t]);

  const doneBody = useMemo(() => {
    const parts: string[] = [];
    for (const key of BABEL_WIZARD_STEP_IDS) {
      const o = state.outputs[key];
      if (o?.content) parts.push(`=== ${key} ===\n${o.content.slice(0, 500_000)}`);
    }
    return parts.join('\n\n');
  }, [state.outputs]);

  const richFuchsia = {
    rich: (chunks: ReactNode) => <code className="text-fuchsia-200/90">{chunks}</code>,
  };
  const richAmber = {
    rich: (chunks: ReactNode) => <code className="text-amber-200/90">{chunks}</code>,
  };
  const richDisk = {
    rich: (chunks: ReactNode) => <code className="text-zinc-500">{chunks}</code>,
  };
  /** Balises `<strong>` dans `checkpointBeforeRich` (messages JSON). */
  const checkpointBeforeRichTags = {
    strong: (chunks: ReactNode) => (
      <strong className="font-semibold text-amber-200">{chunks}</strong>
    ),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => downloadBackup(t('backupNoteQuick'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          <HardDriveDownload className="h-3.5 w-3.5" />
          {t('btnBackupFile')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSaveEverything()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t('btnSaveServerAndFile')}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900">
          <Upload className="h-3.5 w-3.5" />
          {t('restoreFileLabel')}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          onClick={() => void resetWizard()}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('btnReset')}
        </button>
      </div>

      {/* Progress */}
      <div className="flex flex-wrap gap-1">
        {BABEL_WIZARD_STEP_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => setState((s) => ({ ...s, stepIndex: i }))}
            className={`rounded-md px-2 py-1 text-[10px] font-medium ${
              i === state.stepIndex
                ? 'bg-violet-600 text-white'
                : i < state.stepIndex
                  ? 'bg-zinc-800 text-zinc-400'
                  : 'bg-zinc-900 text-zinc-600'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm text-red-200">{err}</div>
      ) : null}
      {msg ? (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-4 py-2 text-sm text-emerald-100">
          {msg}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-violet-400">
              {t('stepLabel', { current: state.stepIndex + 1, total: BABEL_WIZARD_STEP_IDS.length })}
            </p>
            <h2 className="text-lg font-semibold text-white">{stepMeta.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{stepMeta.short}</p>
          </div>
          {stepMeta.usesAi ? (
            <span className="shrink-0 rounded-full border border-violet-500/35 bg-violet-950/50 px-2 py-0.5 text-[10px] text-violet-300">
              {t('badgeAi')}
            </span>
          ) : null}
        </div>

        {/* Locale fields — always visible for context */}
        <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-zinc-800/80 bg-black/20 p-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            {t('localeCodeLabel')}
            <input
              value={localeInput}
              onChange={(e) => setLocaleInput(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
              placeholder={t('placeholderLocale')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            {t('marketLabel')}
            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder={t('placeholderMarket')}
            />
          </label>
        </div>

        {stepId === 'checkpoint' && (
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
              <p className="font-medium text-amber-200">{t('checkpointBeforeTitle')}</p>
              <p className="mt-2">{t.rich('checkpointBeforeRich', checkpointBeforeRichTags)}</p>
            </div>
            <p>{t('checkpointSteps')}</p>
            {sessions.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">{t('sessionsTitle')}</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-2">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-zinc-400">{s.title ?? s.id.slice(0, 8)}</span>
                      <button
                        type="button"
                        onClick={() => void loadSessionFromServer(s.id)}
                        className="shrink-0 text-indigo-400 hover:text-indigo-300"
                      >
                        {t('btnResume')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {stepId === 'catalog' && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAiStep('catalog')}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {t('btnGeneratePreview')}
            </button>
            <PreviewBlock
              content={state.outputs.catalog?.content ?? ''}
              approved={!!state.outputs.catalog?.approved}
              onToggleApproved={(v) => patchOutput(WIZARD_PATCH_STEP.catalog, { approved: v })}
            />
          </div>
        )}

        {stepId === 'messages' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void startMessagesDraft()}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-500/50 bg-violet-950/40 px-3 py-2 text-xs text-violet-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('btnStartDraft')}
              </button>
              <button
                type="button"
                disabled={busy || !state.messagesDraftId}
                onClick={() => void continueOneMessagesBatch()}
                className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-300"
              >
                {t('btnOneBatch')}
              </button>
              <button
                type="button"
                disabled={busy || !state.messagesDraftId}
                onClick={() => void runAllMessagesBatches()}
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200"
              >
                {t('btnAllAuto')}
              </button>
            </div>
            {state.messagesDraftId ? (
              <p className="text-[11px] text-zinc-500">
                {t('messagesDraftIntro')}{' '}
                <code className="text-zinc-400">{state.messagesDraftId}</code>
                {state.messagesProgressDone != null
                  ? t('messagesProgressLine', { done: state.messagesProgressDone })
                  : null}
              </p>
            ) : null}
            <PreviewBlock
              content={state.outputs.messages?.content?.slice(0, 120_000) ?? ''}
              approved={!!state.outputs.messages?.approved}
              onToggleApproved={(v) => patchOutput(WIZARD_PATCH_STEP.messages, { approved: v })}
              tall
            />
          </div>
        )}

        {stepId === 'serverPack' && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAiStep('serverPack')}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {t('btnGeneratePreview')}
            </button>
            <PreviewBlock
              content={state.outputs.serverPack?.content ?? ''}
              approved={!!state.outputs.serverPack?.approved}
              onToggleApproved={(v) => patchOutput(WIZARD_PATCH_STEP.serverPack, { approved: v })}
            />
          </div>
        )}

        {stepId === 'authEmail' && (
          <div className="space-y-3">
            <pre className="max-h-64 overflow-auto rounded-xl border border-zinc-800 bg-black/40 p-3 text-xs text-zinc-400 whitespace-pre-wrap">
              {staticAuthBody}
            </pre>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={!!state.outputs.authEmail?.approved}
                onChange={(e) => patchOutput('authEmail', { content: staticAuthBody, kind: 'text', approved: e.target.checked })}
              />
              {t('authCheckbox', { localeCode: state.localeCode })}
            </label>
          </div>
        )}

        {stepId === 'signup' && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAiStep('signup')}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {t('btnGenerateSignup')}
            </button>
            <PreviewBlock
              content={state.outputs.signup?.content ?? ''}
              approved={!!state.outputs.signup?.approved}
              onToggleApproved={(v) => patchOutput(WIZARD_PATCH_STEP.signup, { approved: v })}
              tall
            />
          </div>
        )}

        {stepId === 'seo' && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAiStep('seo')}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {t('btnGenerateSeo')}
            </button>
            <PreviewBlock
              content={state.outputs.seo?.content ?? ''}
              approved={!!state.outputs.seo?.approved}
              onToggleApproved={(v) => patchOutput(WIZARD_PATCH_STEP.seo, { approved: v })}
            />
          </div>
        )}

        {stepId === 'warRoom' && (
          <div className="space-y-3 text-sm text-zinc-400">
            <pre className="max-h-56 overflow-auto rounded-xl border border-zinc-800 bg-black/40 p-3 text-xs whitespace-pre-wrap">
              {staticWarBody}
            </pre>
            <Link
              href="/dashboard/admin/growth-war-room"
              className="inline-block text-indigo-400 hover:text-indigo-300"
            >
              {t('linkWarRoom')}
            </Link>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!state.outputs.warRoom?.approved}
                onChange={(e) =>
                  patchOutput('warRoom', { content: staticWarBody, kind: 'text', approved: e.target.checked })
                }
              />
              {t('warCheckbox')}
            </label>
          </div>
        )}

        {stepId === 'emailsProduct' && (
          <div className="space-y-3 text-sm text-zinc-400">
            <pre className="max-h-56 overflow-auto rounded-xl border border-zinc-800 bg-black/40 p-3 text-xs whitespace-pre-wrap">
              {staticEmailsBody}
            </pre>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!state.outputs.emailsProduct?.approved}
                onChange={(e) =>
                  patchOutput('emailsProduct', { content: staticEmailsBody, kind: 'text', approved: e.target.checked })
                }
              />
              {t('emailsCheckbox')}
            </label>
          </div>
        )}

        {stepId === 'done' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/25 px-4 py-4 text-sm leading-relaxed text-fuchsia-100/90">
              <p className="text-base font-semibold tracking-tight text-fuchsia-200">{t('singulariteTitle')}</p>
              <p className="mt-2 text-xs text-fuchsia-100/80">
                {t.rich('singulariteBodyRich', {
                  ...richFuchsia,
                  localeCode: state.localeCode,
                })}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void singulariteFullNativeDeploy()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/50 hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-50 sm:w-auto"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                {t('btnFullNativeDeploy')}
              </button>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
              <p className="font-medium text-amber-200">{t('advancedOptionsTitle')}</p>
              <p className="mt-2 text-amber-100/75">
                {t.rich('advancedOptionsBodyRich', {
                  ...richAmber,
                  pathFragment: t('pathFragmentLocalePlaceholder'),
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-3 text-sm text-zinc-400">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={mergeTs} onChange={(e) => setMergeTs(e.target.checked)} />
                {t('optSmartMerge')}
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={doGit} onChange={(e) => setDoGit(e.target.checked)} />
                {t('optGitCommit')}
              </label>
            </div>
            <p className="text-sm text-zinc-400">{t.rich('diskWriteBlurb', richDisk)}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyToDisk(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {t('btnWriteDisk')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyToDisk(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-500/50 bg-orange-950/30 px-4 py-2 text-sm text-orange-100 hover:bg-orange-950/50 disabled:opacity-50"
              >
                {t('btnWriteDiskProbe', { localeCode: state.localeCode })}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyOverlordFull(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
              >
                {t('btnFullNativeSoft')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applySmartMergeOnly()}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t('btnSmartMergeOnly')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob(
                  [
                    buildWizardBackupJson({
                      state,
                      serverSessionId,
                      note: t('exportNoteFinal'),
                    }),
                    t('exportConcatSeparator'),
                    doneBody,
                  ],
                  { type: 'text/plain;charset=utf-8' }
                );
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `babel-wizard-export-${state.localeCode}.txt`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
            >
              <Download className="h-4 w-4" />
              {t('btnDownloadExport')}
            </button>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            disabled={state.stepIndex === 0 || busy}
            onClick={goPrev}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('footerPrev')}
          </button>
          <button
            type="button"
            disabled={busy || state.stepIndex >= STEP_LAST}
            onClick={() => void goNext()}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-40"
          >
            {t('footerNext')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <p className="text-center">
        <Link href="/dashboard/admin/babel-guardian" className="text-xs text-zinc-500 hover:text-zinc-300">
          {t('linkBabelGuardian')}
        </Link>
      </p>
    </div>
  );
}

function PreviewBlock(props: {
  content: string;
  approved: boolean;
  onToggleApproved: (v: boolean) => void;
  tall?: boolean;
}) {
  const { content, approved, onToggleApproved, tall } = props;
  const t = useTranslations('Admin.babelWizard');
  return (
    <div className="space-y-2">
      <pre
        className={`overflow-auto rounded-xl border border-zinc-800 bg-black/50 p-3 text-[11px] leading-relaxed text-zinc-400 ${tall ? 'max-h-[28rem]' : 'max-h-64'}`}
      >
        {content || t('noPreview')}
      </pre>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={approved} onChange={(e) => onToggleApproved(e.target.checked)} />
        {t('previewCheckbox')}
      </label>
    </div>
  );
}
