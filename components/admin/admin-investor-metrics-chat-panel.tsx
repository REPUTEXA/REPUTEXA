'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InvestorMetricsPayload } from '@/lib/admin/investor-metrics';

type Msg = { role: 'user' | 'assistant'; content: string };

const STORAGE_KEY = 'reputexa-admin-investor-copilot-messages-v1';

type Props = {
  metrics: InvestorMetricsPayload | null;
  loading?: boolean;
  className?: string;
};

/**
 * Barre pleine largeur en bas de bloc : aperçu du dossier à gauche, fil de discussion compact, saisie.
 * Le payload `metrics` est réinjecté à chaque message côté API.
 */
export function AdminInvestorCopilotBar({ metrics, loading = false, className = '' }: Props) {
  const t = useTranslations('Admin.investorCopilotBar');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const ok = parsed.filter(
            (m): m is Msg =>
              m &&
              typeof m === 'object' &&
              (m as Msg).role !== undefined &&
              typeof (m as Msg).content === 'string' &&
              ((m as Msg).role === 'user' || (m as Msg).role === 'assistant')
          );
          if (ok.length) setMessages(ok.slice(-40));
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, hydrated]);

  const scrollEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const send = async () => {
    const q = input.trim();
    if (!q || !metrics) {
      if (!metrics && !loading) toast.error(t('toastWaitMetricsLoad'));
      return;
    }
    setInput('');
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setBusy(true);
    requestAnimationFrame(scrollEnd);
    try {
      const res = await fetch('/api/admin/investor-metrics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          metrics,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      const reply = typeof data.reply === 'string' ? data.reply : '';
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Copilot indisponible');
      setMessages(next);
    } finally {
      setBusy(false);
      setTimeout(scrollEnd, 80);
    }
  };

  return (
    <div
      className={`rounded-xl border border-amber-500/40 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/95 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] ${className}`}
      aria-label={t('copilotAriaLabel')}
    >
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-0 lg:gap-0">
        <div className="lg:w-[min(260px,100%)] shrink-0 p-4 lg:border-r border-zinc-800/90 border-b lg:border-b-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400/90 shrink-0" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/95">{t('copilotTitle')}</p>
          </div>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">
            {t.rich('copilotIntroRich', {
              mrrTreasury: (chunks) => <strong className="text-zinc-200">{chunks}</strong>,
              matchedSubs: (chunks) => <strong className="text-zinc-200">{chunks}</strong>,
            })}
          </p>
          <p className="text-[10px] font-mono text-zinc-600 mt-3">
            {t('copilotSyncLine', {
              time: metrics?.generatedAt ?? (loading ? t('copilotLoading') : '—'),
            })}
          </p>
          <p className="text-[10px] text-zinc-600 leading-relaxed mt-2 pt-2 border-t border-zinc-800/80">
            {t('copilotDisclaimer')}
          </p>
        </div>

        <div className="flex-1 flex flex-col min-h-[200px] min-w-0">
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2.5 text-[12px] leading-relaxed max-h-[min(220px,40vh)] border-b border-zinc-800/80">
            {hydrated && messages.length === 0 && (
              <p className="text-zinc-500 text-xs leading-relaxed">{t('copilotExamples')}</p>
            )}
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
                className={`rounded-lg px-3 py-2 ${
                  m.role === 'user'
                    ? 'bg-zinc-900/90 text-zinc-100 ml-4 border border-amber-500/15'
                    : 'bg-zinc-900/50 text-zinc-300 mr-4 border border-zinc-800/90'
                }`}
              >
                <p className="text-[9px] uppercase tracking-[0.12em] text-amber-200/65 mb-1">
                  {m.role === 'user' ? t('copilotRoleUser') : t('copilotRoleAssistant')}
                </p>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {busy && <p className="text-zinc-500 text-xs italic px-1">{t('copilotComposing')}</p>}
            <div ref={endRef} />
          </div>

          <div className="p-3 sm:p-4 flex gap-2 items-end bg-zinc-950/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={t('copilotPlaceholder')}
              className="flex-1 resize-none rounded-lg bg-zinc-900/90 border border-amber-500/20 text-zinc-100 text-sm px-3 py-2 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 min-w-0"
              disabled={busy || !metrics}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !metrics}
              className="shrink-0 inline-flex items-center justify-center rounded-lg bg-amber-600/85 hover:bg-amber-600 disabled:opacity-40 px-3 py-2.5 text-white border border-amber-500/30"
              aria-label={t('copilotSendAria')}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated préférer AdminInvestorCopilotBar (barre bas de page) */
export const AdminInvestorCopilotColumn = AdminInvestorCopilotBar;

/** @deprecated utiliser AdminInvestorCopilotBar */
export const AdminInvestorMetricsChatPanel = AdminInvestorCopilotBar;
