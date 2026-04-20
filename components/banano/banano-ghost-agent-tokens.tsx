'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Key, Loader2, Monitor, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

type GhostAgentTokenRow = {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function BananoGhostAgentTokensSection() {
  const t = useTranslations('Dashboard.bananoGhostTokens');
  const locale = useLocale();
  const intlTag = siteLocaleToIntlDateTag(locale);

  const formatDt = useCallback(
    (iso: string | null): string => {
      if (!iso) return t('dash');
      try {
        return new Date(iso).toLocaleString(intlTag, {
          dateStyle: 'short',
          timeStyle: 'short',
        });
      } catch {
        return t('dash');
      }
    },
    [intlTag, t]
  );

  const [tokens, setTokens] = useState<GhostAgentTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/banano/ghost/agent-tokens');
      const data = (await res.json()) as { tokens?: GhostAgentTokenRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      setTokens(data.tokens ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastLoadFail'));
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  async function submitCreate() {
    setAddBusy(true);
    try {
      const res = await fetch('/api/banano/ghost/agent-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: addLabel.trim() || undefined }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? t('toastCreateFail'));
      setAddOpen(false);
      setAddLabel('');
      setRevealedSecret(data.token);
      void loadTokens();
      toast.success(t('toastCreateOk'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setAddBusy(false);
    }
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success(t('toastCopyOk'));
    } catch {
      toast.error(t('toastCopyFail'));
    }
  }

  async function revoke(id: string, label: string) {
    if (!window.confirm(t('confirmRevoke', { label: label || t('agentFallback') }))) {
      return;
    }
    setRevokingId(id);
    try {
      const res = await fetch(`/api/banano/ghost/agent-token/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('toastRevokeFail'));
      toast.success(t('toastRevokedOk'));
      void loadTokens();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setRevokingId(null);
    }
  }

  const active = tokens.filter((tok) => !tok.revoked_at);
  const revoked = tokens.filter((tok) => tok.revoked_at);

  return (
    <>
      <section
        className="rounded-2xl border border-amber-500/25 dark:border-amber-500/20 shadow-[0_0_48px_-16px_rgba(245,158,11,0.22)] overflow-hidden"
        style={{
          background:
            'linear-gradient(145deg, rgb(15 23 42 / 0.97) 0%, rgb(12 18 34) 45%, rgb(15 23 42 / 0.98) 100%)',
        }}
      >
        <div className="p-4 sm:p-6 space-y-4 border-b border-amber-500/15">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-500/95">
                <Monitor className="w-5 h-5 shrink-0" aria-hidden />
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-100">{t('title')}</h3>
              </div>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">{t('intro')}</p>
              <p className="text-[11px] text-slate-500 max-w-xl leading-relaxed pt-2 border-t border-amber-500/10 mt-2">
                <strong className="text-slate-400">{t('testMacroBold')}</strong> {t('testMacroRest')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-semibold text-sm hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-900/30 shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t('ctaAdd')}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500/80" />
              {t('loading')}
            </div>
          ) : active.length === 0 && revoked.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t('empty')}</p>
          ) : (
            <div className="space-y-6">
              {active.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-700/80 bg-slate-900/50">
                        <th className="px-3 py-2.5 font-semibold text-slate-300">{t('thAgent')}</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-300 hidden sm:table-cell">
                          {t('thCreated')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-300 hidden md:table-cell">
                          {t('thLastUsed')}
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-300 w-28 text-right">
                          {t('thAction')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-800/80 hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2 text-slate-100">
                              <Key className="w-3.5 h-3.5 text-amber-500/90 shrink-0" />
                              <span className="font-medium">{row.label || t('agentFallback')}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 sm:hidden">
                              {formatDt(row.created_at)}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell">
                            {formatDt(row.created_at)}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 hidden md:table-cell">
                            {formatDt(row.last_used_at)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              disabled={revokingId === row.id}
                              onClick={() => void revoke(row.id, row.label)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-300 hover:bg-red-950/50 border border-red-900/40 disabled:opacity-40"
                            >
                              {revokingId === row.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              {t('revoke')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {revoked.length > 0 ? (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer text-slate-400 hover:text-slate-300 py-1">
                    {t('revokedList', { count: revoked.length })}
                  </summary>
                  <ul className="mt-2 space-y-1 pl-3 border-l border-slate-700">
                    {revoked.map((row) => (
                      <li key={row.id} className="text-slate-500">
                        {t('revokedLine', {
                          label: row.label || t('agentFallback'),
                          date: formatDt(row.revoked_at),
                        })}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {addOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                aria-label={t('close')}
                onClick={() => !addBusy && setAddOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ghost-add-title"
                className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-600 bg-[#0c1222] shadow-2xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 id="ghost-add-title" className="text-base font-bold text-slate-50 pr-6">
                    {t('dialogNewTitle')}
                  </h3>
                  <button
                    type="button"
                    disabled={addBusy}
                    onClick={() => setAddOpen(false)}
                    className="shrink-0 p-2 rounded-xl hover:bg-slate-800 text-slate-400"
                    aria-label={t('close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <label className="block text-xs text-slate-400">
                  {t('labelPostName')}
                  <input
                    type="text"
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value.slice(0, 80))}
                    placeholder={t('placeholderPostName')}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-950 text-slate-100 text-sm"
                  />
                </label>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t('dialogHint')}</p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    disabled={addBusy}
                    onClick={() => setAddOpen(false)}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-600 text-slate-200 font-semibold hover:bg-slate-800/80"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={addBusy}
                    onClick={() => void submitCreate()}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 disabled:opacity-45"
                  >
                    {addBusy ? (
                      <span className="inline-flex items-center gap-2 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('creating')}
                      </span>
                    ) : (
                      t('generateToken')
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {revealedSecret && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[230] flex items-end sm:items-center justify-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
                aria-label={t('close')}
                onClick={() => setRevealedSecret(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ghost-secret-title"
                className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-amber-500/35 bg-[#0a0f1c] shadow-2xl p-5 space-y-4"
              >
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-950/25 p-3">
                  <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p id="ghost-secret-title" className="text-sm font-bold text-amber-100">
                      {t('secretTitle')}
                    </p>
                    <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">{t('secretBody')}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] sm:text-xs text-amber-100/95 break-all leading-relaxed select-all">
                  {revealedSecret}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => void copySecret(revealedSecret)}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 inline-flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {t('copy')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevealedSecret(null)}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-600 text-slate-200 font-semibold hover:bg-slate-800/80"
                  >
                    {t('savedClose')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
